"use strict";

window.addEventListener("DOMContentLoaded", () => {
	const elems = {};
	document.querySelectorAll("[id]").forEach((e) => elems[e.id] = e);

	const uart = new UART();

	const ROM_START = 0x0000;
	const RAM_START = 0x8000;

	let ROM = new Uint8Array(0);
	let RAM = new Uint8Array(0);
	let RAMdirty = new Uint8Array(0);
	const ROMViewerCache = {
		address: new Map(),
		byte: new Map(),
		chars: new Map()
	};
	const RAMViewerCache = {
		address: new Map(),
		byte: new Map(),
		chars: new Map(),
		getEditTarget: () => ({ data: RAM, dirty: RAMdirty }),
	};

	const readMemory = (address) => {
		if (ROM_START <= address && address < ROM_START + ROM.length) {
			return ROM[address - ROM_START];
		} else if (RAM_START <= address && address < RAM_START + RAM.length) {
			return RAM[address - RAM_START];
		} else if (address === 0xe000) {
			// UART受信
			return uart.readDataRegister() & 0xff;
		} else if (address === 0xe001) {
			// UART状態
			const status = uart.getStatus();
			return (
				(status.rxBufferHasData ? 1 : 0) |
				(status.txBufferHasSpace ? 2 : 0) |
				(status.rxOverflow ? 4 : 0)
			);
		}
		return 0xff;
	};

	const writeMemory = (address, data) => {
		if (RAM_START <= address && address < RAM_START + RAM.length) {
			RAM[address - RAM_START] = data;
			RAMdirty[address - RAM_START] = 1;
		} else if (address === 0xe000) {
			// UART送信
			uart.writeDataRegister(data);
		}
	};

	const cpu = new R80C26(readMemory, writeMemory);
	let running = false;
	let elapsedSteps = 0, elapsedClocks = 0, renderedElepsedSteps = null, renderedElapsedClocks = null;
	let budgetPreviousTime = null, clockBudget = 0;
	let speedPreviousTime = performance.now(), speedPreviousClocks = 0;
	let targetSpeed = 0;
	const updateTargetSpeed = () => {
		const value = parseFloat(elems.speedInput.value);
		targetSpeed = isNaN(value) || value < 0 ? 0 : value;
	};
	elems.speedInput.addEventListener("change", updateTargetSpeed);
	updateTargetSpeed();

	const setRunning = (newRunning) => {
		if (newRunning) {
			elems.runButton.disabled = true;
			elems.pauseButton.disabled = false;
			elems.stepButton.disabled = true;
			if (!running) {
				budgetPreviousTime = null;
				clockBudget = 0;
			}
			running = true;
		} else {
			elems.runButton.disabled = false;
			elems.pauseButton.disabled = true;
			elems.stepButton.disabled = false;
			running = false;
		}
	};
	setRunning(false);

	// dirty が指定されていないとき、サイズの変更も含めたフル同期を行う
	// dirty が指定されているとき、サイズの変更は無いと仮定し、変化した部分のみ更新する
	const renderMemoryContents = (element, cache, data, addressOffset, dirty = null) => {
		for (let i = 0; i < data.length; i += 16) {
			let lineDirty = !dirty;
			let lineChars = "";
			for (let j = 0; j < 16 && (i + j < data.length || i === 0); j++) {
				const address = i + j;
				if (!dirty || dirty[address]) {
					let byteElement = cache.byte.get(address);
					if (!byteElement) {
						byteElement = document.createElement("div");
						byteElement.classList.add("byte");
						byteElement.style.gridRow = Math.floor(i / 16) + 1;
						byteElement.style.gridColumn = 3 + j + Math.floor(j / 4);
						cache.byte.set(address, byteElement);
						element.appendChild(byteElement);
						if (cache.getEditTarget) {
							byteElement.classList.add("editable");
							byteElement.addEventListener("click", () => {
								if (!byteElement.getAttribute("data-editing")) {
									byteElement.setAttribute("data-editing", "1");
									const input = document.createElement("input");
									input.setAttribute("type", "text");
									input.setAttribute("size", "2");
									input.setAttribute("maxlength", "2");
									input.value = byteElement.textContent;
									byteElement.appendChild(input);
									const enterInput = () => {
										const value = parseInt(input.value, 16);
										const { data, dirty } = cache.getEditTarget();
										if (address < data.length) {
											data[address] = value;
											dirty[address] = 1;
										}
										byteElement.removeAttribute("data-editing");
										byteElement.removeChild(input);
									};
									input.addEventListener("keydown", (event) => {
										if (event.key === "Enter" && !event.isComposing) enterInput();
									});
									input.addEventListener("blur", enterInput);
									input.focus();
									input.select();
								}
							});
						}
					}
					if (!byteElement.getAttribute("data-editing")) {
						const byteString = address < data.length ? "0" + data[address].toString(16) : "  ";
						byteElement.textContent = byteString.substring(byteString.length - 2);
						if (dirty && address < dirty.length) dirty[address] = 0;
					}
				}
				lineChars +=
					address >= data.length ? " " :
					0x20 <= data[address] && data[address] < 0x7f ? String.fromCharCode(data[address]) :
					".";
			}
			if (lineDirty) {
				let charsElement = cache.chars.get(i);
				if (!charsElement) {
					charsElement = document.createElement("div");
					charsElement.classList.add("chars");
					charsElement.style.gridRow = Math.floor(i / 16) + 1;
					cache.chars.set(i, charsElement);
					element.appendChild(charsElement);
				}
				charsElement.textContent = lineChars;
			}
		}
		if (!dirty) {
			for (let i = 0; i < data.length; i += 16) {
				let addressElement = cache.address.get(i);
				if (!addressElement) {
					addressElement = document.createElement("div");
					addressElement.classList.add("address");
					addressElement.style.gridRow = Math.floor(i / 16) + 1;
					cache.address.set(i, addressElement);
					element.appendChild(addressElement);
				}
				const addressString = "000" + (addressOffset + i).toString(16);
				addressElement.textContent = addressString.substring(addressString.length - 4);
			}
			for (let i = Math.floor((data.length + 15) / 16) * 16; ; i += 16) {
				const addressToRemove = cache.address.get(i);
				const charsToRemove = cache.chars.get(i);
				if (!addressToRemove && !charsToRemove) break;
				if (addressToRemove) {
					element.removeChild(addressToRemove);
					cache.address.delete(i);
				}
				if (charsToRemove) {
					element.removeChild(charsToRemove);
					cache.chars.delete(i);
				}
			}
			for (let i = data.length === 0 ? 0 : Math.max(data.length, 16); ; i++) {
				const byteToRemove = cache.byte.get(i);
				if (!byteToRemove) break;
				element.removeChild(byteToRemove);
				cache.byte.delete(i);
			}
		}
	};

	const setContents = (element, contents) => {
		while (element.firstChild) element.removeChild(element.firstChild);
		element.appendChild(contents);
	};

	// 非負整数を3桁ずつ区切る
	const renderNumber = (value) => {
		const result = document.createElement("span");
		result.classList.add("splittedNumber");
		const valueStr = value.toFixed(0);
		const firstDigits = valueStr.length % 3;
		if (firstDigits > 0) {
			const span = document.createElement("span");
			span.appendChild(document.createTextNode(valueStr.substring(0, firstDigits)));
			result.appendChild(span);
		}
		for (let i = firstDigits; i < valueStr.length; i += 3) {
			const span = document.createElement("span");
			span.appendChild(document.createTextNode(valueStr.substring(i, i + 3)));
			result.appendChild(span);
		}
		return result;
	};

	const setRegister = (element, registerName) => {
		const value = parseInt(element.value);
		if (isNaN(value)) return;
		cpu[registerName] = value;
	};
	const setFlag = (element, flagBit) => {
		if (element.checked) {
			cpu.F |= 1 << flagBit;
		} else {
			cpu.F &= ~(1 << flagBit);
		}
	};
	elems.registerInputA.addEventListener("change", () => setRegister(elems.registerInputA, "A"));
	elems.registerInputF.addEventListener("change", () => setRegister(elems.registerInputF, "F"));
	elems.registerInputB.addEventListener("change", () => setRegister(elems.registerInputB, "B"));
	elems.registerInputC.addEventListener("change", () => setRegister(elems.registerInputC, "C"));
	elems.registerInputD.addEventListener("change", () => setRegister(elems.registerInputD, "D"));
	elems.registerInputE.addEventListener("change", () => setRegister(elems.registerInputE, "E"));
	elems.registerInputH.addEventListener("change", () => setRegister(elems.registerInputH, "H"));
	elems.registerInputL.addEventListener("change", () => setRegister(elems.registerInputL, "L"));
	elems.registerInputAp.addEventListener("change", () => setRegister(elems.registerInputAp, "Ap"));
	elems.registerInputFp.addEventListener("change", () => setRegister(elems.registerInputFp, "Fp"));
	elems.registerInputBp.addEventListener("change", () => setRegister(elems.registerInputBp, "Bp"));
	elems.registerInputCp.addEventListener("change", () => setRegister(elems.registerInputCp, "Cp"));
	elems.registerInputDp.addEventListener("change", () => setRegister(elems.registerInputDp, "Dp"));
	elems.registerInputEp.addEventListener("change", () => setRegister(elems.registerInputEp, "Ep"));
	elems.registerInputHp.addEventListener("change", () => setRegister(elems.registerInputHp, "Hp"));
	elems.registerInputLp.addEventListener("change", () => setRegister(elems.registerInputLp, "Lp"));
	elems.registerInputI.addEventListener("change", () => setRegister(elems.registerInputI, "I"));
	elems.registerInputR.addEventListener("change", () => setRegister(elems.registerInputR, "R"));
	elems.registerInputIX.addEventListener("change", () => setRegister(elems.registerInputIX, "IX"));
	elems.registerInputIY.addEventListener("change", () => setRegister(elems.registerInputIY, "IY"));
	elems.registerInputSP.addEventListener("change", () => setRegister(elems.registerInputSP, "SP"));
	elems.registerInputPC.addEventListener("change", () => setRegister(elems.registerInputPC, "PC"));
	elems.registerInputBC.addEventListener("change", () => setRegister(elems.registerInputBC, "BC"));
	elems.registerInputDE.addEventListener("change", () => setRegister(elems.registerInputDE, "DE"));
	elems.registerInputHL.addEventListener("change", () => setRegister(elems.registerInputHL, "HL"));
	elems.registerInputIFF1.addEventListener("change", () => cpu.IFF1 = elems.registerInputIFF1.checked);
	elems.registerInputIFF2.addEventListener("change", () => cpu.IFF2 = elems.registerInputIFF2.checked);
	elems.registerInputIMF_0.addEventListener("change", () => cpu.IMF = 0);
	elems.registerInputIMF_1.addEventListener("change", () => cpu.IMF = 1);
	elems.registerInputIMF_2.addEventListener("change", () => cpu.IMF = 2);
	elems.flagInputS.addEventListener("change", () => setFlag(elems.flagInputS, 7));
	elems.flagInputZ.addEventListener("change", () => setFlag(elems.flagInputZ, 6));
	elems.flagInputH.addEventListener("change", () => setFlag(elems.flagInputH, 4));
	elems.flagInputPV.addEventListener("change", () => setFlag(elems.flagInputPV, 2));
	elems.flagInputN.addEventListener("change", () => setFlag(elems.flagInputN, 1));
	elems.flagInputC.addEventListener("change", () => setFlag(elems.flagInputC, 0));

	const setValueIfNotFocused = (element, value) => {
		if (document.activeElement !== element) element.value = value;
	};

	const renderCpuStatus = () => {
		const render8bit = elems.displayFormatSignedDecimal.checked ? (value) => {
			return (value >= 0x80 ? value - 0x100 : value).toString();
		} : elems.displayFormatUnsignedDecimal.checked ? (value) => {
			return value.toString();
		} : (value) => {
			const rendered = "0" + value.toString(16);
			return "0x" + rendered.substring(rendered.length - 2);
		};
		const render16bit = elems.displayFormatSignedDecimal.checked ? (value) => {
			return (value >= 0x8000 ? value - 0x10000 : value).toString();
		} : elems.displayFormatUnsignedDecimal.checked ? (value) => {
			return value.toString();
		} : (value) => {
			const rendered = "000" + value.toString(16);
			return "0x" + rendered.substring(rendered.length - 4);
		};
		const renderSpPc = elems.alwaysDisplaySpPcInHex.checked ? (value) => {
			const rendered = "000" + value.toString(16);
			return "0x" + rendered.substring(rendered.length - 4);
		} : render16bit;
		setValueIfNotFocused(elems.registerInputA, render8bit(cpu.A));
		setValueIfNotFocused(elems.registerInputF, render8bit(cpu.F));
		setValueIfNotFocused(elems.registerInputB, render8bit(cpu.B));
		setValueIfNotFocused(elems.registerInputC, render8bit(cpu.C));
		setValueIfNotFocused(elems.registerInputD, render8bit(cpu.D));
		setValueIfNotFocused(elems.registerInputE, render8bit(cpu.E));
		setValueIfNotFocused(elems.registerInputH, render8bit(cpu.H));
		setValueIfNotFocused(elems.registerInputL, render8bit(cpu.L));
		setValueIfNotFocused(elems.registerInputAp, render8bit(cpu.Ap));
		setValueIfNotFocused(elems.registerInputFp, render8bit(cpu.Fp));
		setValueIfNotFocused(elems.registerInputBp, render8bit(cpu.Bp));
		setValueIfNotFocused(elems.registerInputCp, render8bit(cpu.Cp));
		setValueIfNotFocused(elems.registerInputDp, render8bit(cpu.Dp));
		setValueIfNotFocused(elems.registerInputEp, render8bit(cpu.Ep));
		setValueIfNotFocused(elems.registerInputHp, render8bit(cpu.Hp));
		setValueIfNotFocused(elems.registerInputLp, render8bit(cpu.Lp));
		setValueIfNotFocused(elems.registerInputI, render8bit(cpu.I));
		setValueIfNotFocused(elems.registerInputR, render8bit(cpu.R));
		setValueIfNotFocused(elems.registerInputIX, render16bit(cpu.IX));
		setValueIfNotFocused(elems.registerInputIY, render16bit(cpu.IY));
		setValueIfNotFocused(elems.registerInputBC, render16bit(cpu.BC));
		setValueIfNotFocused(elems.registerInputDE, render16bit(cpu.DE));
		setValueIfNotFocused(elems.registerInputHL, render16bit(cpu.HL));
		setValueIfNotFocused(elems.registerInputSP, renderSpPc(cpu.SP));
		setValueIfNotFocused(elems.registerInputPC, renderSpPc(cpu.PC));
		elems.registerInputIFF1.checked = cpu.IFF1;
		elems.registerInputIFF2.checked = cpu.IFF2;
		elems.registerInputIMF_0.checked = cpu.IMF === 0;
		elems.registerInputIMF_1.checked = cpu.IMF === 1;
		elems.registerInputIMF_2.checked = cpu.IMF === 2;
		elems.flagInputS.checked = cpu.F & 0x80;
		elems.flagInputZ.checked = cpu.F & 0x40;
		elems.flagInputH.checked = cpu.F & 0x10;
		elems.flagInputPV.checked = cpu.F & 0x04;
		elems.flagInputN.checked = cpu.F & 0x02;
		elems.flagInputC.checked = cpu.F & 0x01;
	};

	elems.runButton.addEventListener("click", () => setRunning(true));
	elems.pauseButton.addEventListener("click", () => setRunning(false));
	elems.stepButton.addEventListener("click", () => {
		const clocksDelta = cpu.step();
		elapsedClocks += clocksDelta;
		elapsedSteps++;
		if (targetSpeed > 0) uart.progressTime(1e-6 / targetSpeed * clocksDelta);
	});
	elems.resetButton.addEventListener("click", () => {
		setRunning(false);
		cpu.reset();
		uart.reset();
		for (let i = 0; i < RAM.length; i++) {
			RAM[i] = 0xff;
			RAMdirty[i] = 1;
		}
		elapsedSteps = 0;
		elapsedClocks = 0;
	});

	let consoleAreaStatus = null;
	const utf8Encoder = new TextEncoder();
	const utf8Decoder = new TextDecoder();
	const receiveBuffer = [];
	const sendStringToUART = (str) => {
		const normalizedData = str.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
		const useCrAsNewline = false; // TODO：UIから取得
		const convertedData = useCrAsNewline ? normalizedData.replace(/\n/g, "\r") : normalizedData;
		uart.addReceivedData(utf8Encoder.encode(convertedData));
	};
	const receiveDataFromUART = (dataArray) => {
		let stringToAdd = "";
		dataArray.forEach((c) => {
			if (receiveBuffer.length > 0) {
				if (0x80 <= c && c < 0xc0) {
					// UTF-8の2バイト目以降
					receiveBuffer.push(c);
					const targetLength = receiveBuffer[0] < 0xe0 ? 2 : (receiveBuffer[0] < 0xf0 ? 3 : 4);
					if (receiveBuffer.length >= targetLength) {
						stringToAdd += utf8Decoder.decode(new Uint8Array(receiveBuffer));
						receiveBuffer.splice(0);
					}
					return;
				} else {
					stringToAdd += receiveBuffer.map((c) => String.fromCharCode(c)).join("");
					// 今回受け取った文字はあらためて下のコードで処理する
				}
			}
			if (0xc0 <= c && c < 0xf8) {
				// UTF-8の1バイト目
				receiveBuffer.push(c);
			} else {
				stringToAdd += String.fromCharCode(c);
			}
		});
		if (stringToAdd.length > 0) {
			const area = elems.consoleArea;
			const isBottomShown = area.scrollTop >= area.scrollHeight - area.clientHeight - 1;
			const oldValue = area.value;
			const selectionStart = area.selectionStart;
			const selectionEnd = area.selectionEnd;
			const selectionDirection = area.selectionDirection;
			area.value += stringToAdd;
			area.selectionEnd = selectionEnd;
			area.selectionStart = selectionStart === oldValue.length ? area.value.length : selectionStart;
			area.selectionDirection = selectionDirection;
			if (isBottomShown) area.scrollTop = area.scrollHeight;
		}
	};
	elems.consoleArea.addEventListener("beforeinput", (event) => {
		if (event.inputType === "insertCompositionText") {
			if (!consoleAreaStatus) {
				consoleAreaStatus = {
					value: elems.consoleArea.value,
					selectionStart: elems.consoleArea.selectionStart,
					selectionEnd: elems.consoleArea.selectionEnd,
					selectionDirection: elems.consoleArea.selectionDirection,
				};
			}
		} else {
			event.preventDefault();
			if (event.inputType === "insertLineBreak") {
				sendStringToUART("\n");
			} else if (event.inputType.startsWith("insert") && event.inputType !== "insertLink" && event.data !== null) {
				sendStringToUART(event.data);
			} else if (event.inputType.startsWith("delete")) {
				if (event.inputType.endsWith("Backward")) sendStringToUART("\x08");
				else if (event.inputType.endsWith("Forward")) sendStringToUART("\x7f");
			}
		}
	});
	elems.consoleArea.addEventListener("input", (event) => {
		if (!event.isComposing) {
			if (consoleAreaStatus) {
				elems.consoleArea.value = consoleAreaStatus.value;
				elems.consoleArea.selectionStart = consoleAreaStatus.selectionStart;
				elems.consoleArea.selectionEnd = consoleAreaStatus.selectionEnd
				elems.consoleArea.selectionDirection = consoleAreaStatus.selectionDirection;
				consoleAreaStatus = null;
			}
			if (event.data !== null) sendStringToUART(event.data);
		}
	});

	// TODO：UIからの設定
	uart.localEcho = true;
	uart.rxCharDelay = 0.010;
	uart.rxLineDelay = 0.300;

	const updateROM = () => {
		const programData = elems.programInput.value;
		const newRom = new Uint8Array(0x8000);
		for (let i = 0; i < newRom.length; i++) newRom[i] = 0xff;
		let newRomSize = 0;
		// Intel HEX と仮定してパースする
		const lines = programData.split(/[\r\n]/);
		let validHexLineFound = false;
		let hexOffset = 0;
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (/^:([0-9a-f]{2})+$/i.test(line)) {
				const lineData = [];
				for (let j = 1; j < line.length; j += 2) {
					lineData.push(parseInt(line.substring(j, j + 2), 16));
				}
				if (lineData[0] !== lineData.length - 5) continue;
				let checksum = 0;
				for (let j = 0; j < lineData.length; j++) checksum += lineData[j];
				if (checksum % 0x100 !== 0) continue;
				switch (lineData[3]) {
					case 0: // データ
						{
							const startAddress = (lineData[1] << 8) | lineData[2];
							for (let j = 0; j < lineData[0]; j++) {
								const address = hexOffset + startAddress + j;
								if (0 <= address && address < newRom.length) {
									newRom[address] = lineData[4 + j];
									if (newRomSize <= address) newRomSize = address + 1;
								}
							}
						}
						validHexLineFound = true;
						break;
					case 1: // End Of File
						if (lineData[0] === 0) validHexLineFound = true;
						break;
					case 2: // 拡張セグメントアドレス
						if (lineData[0] === 2) {
							hexOffset = ((lineData[4] << 8) | lineData[5]) << 4;
							validHexLineFound = true;
						}
						break;
					case 3: // 開始セグメントアドレス
						if (lineData[0] === 4) validHexLineFound = true;
						break;
					case 4: // 拡張リニアアドレス
						if (lineData[0] === 2) {
							hexOffset = ((lineData[4] << 8) | lineData[5]) * 0x10000;
							validHexLineFound = true;
						}
						break;
					case 5: // 開始リニアアドレス
						if (lineData[0] === 4) validHexLineFound = true;
						break;
				}
			}
		}
		// Intel HEX じゃなさそうなら、配列データとしてパースする
		if (!validHexLineFound) {
			const arrayElements = programData.split(",");
			for (let i = 0; i < arrayElements.length && i < newRom.length; i++) {
				const value = parseInt(arrayElements[i]);
				if (!isNaN(value)) {
					newRom[i] = value;
					newRomSize = i + 1;
				}
			}
		}
		// 得られたデータを適用する
		ROM = new Uint8Array(newRomSize);
		for (let i = 0; i < newRomSize; i++) ROM[i] = newRom[i];
		elems.romSizeArea.textContent = (newRomSize / 1024).toFixed(2);
		renderMemoryContents(elems.romContents, ROMViewerCache, ROM, 0);
	};
	elems.programInput.addEventListener("change", updateROM);
	updateROM();

	const changeRamSize = () => {
		const newRamSizeRaw = parseFloat(elems.ramSizeInput.value);
		if (isNaN(newRamSizeRaw) || newRamSizeRaw < 0) return;
		const newRamSize = Math.min(0x6000, Math.ceil(newRamSizeRaw * 1024));
		const newRam = new Uint8Array(newRamSize);
		for (let i = 0; i < RAM.length && i < newRam.length; i++) {
			newRam[i] = RAM[i];
		}
		for (let i = RAM.length; i < newRam.length; i++) newRam[i] = 0xff;
		RAM = newRam;
		RAMdirty = new Uint8Array(RAM.length);
		renderMemoryContents(elems.ramContents, RAMViewerCache, RAM, 0x8000);
	};
	elems.ramSizeInput.addEventListener("change", changeRamSize);
	changeRamSize();

	const tick = (currentTime) => {
		if (clockBudget > 0) clockBudget = 0;
		if (running) {
			if (budgetPreviousTime !== null) {
				clockBudget += Math.max(0, targetSpeed * (currentTime - budgetPreviousTime) * 1000);
			}
			const finishTime = currentTime + 2000;
			budgetPreviousTime = currentTime;
			while (clockBudget > 0 && (elapsedSteps % 10000 !== 0 || performance.now() < finishTime)) {
				const clocksDelta = cpu.step();
				elapsedSteps++;
				elapsedClocks += clocksDelta;
				clockBudget -= clocksDelta;
				if (targetSpeed > 0) uart.progressTime(1e-6 / targetSpeed * clocksDelta);
			}
		}
		renderCpuStatus();
		if (!consoleAreaStatus) {
			receiveDataFromUART(uart.getDataSent());
		}
		if (renderedElepsedSteps !== elapsedSteps) {
			setContents(elems.elapsedStepsDisplay, renderNumber(elapsedSteps));
			renderedElepsedSteps = elapsedSteps;
		}
		if (renderedElapsedClocks !== elapsedClocks) {
			setContents(elems.elapsedClocksDisplay, renderNumber(elapsedClocks));
			renderedElapsedClocks = elapsedClocks;
		}
		renderMemoryContents(elems.ramContents, RAMViewerCache, RAM, 0x8000, RAMdirty);
		if (currentTime - speedPreviousTime >= 1000) {
			const currentSpeed = (elapsedClocks - speedPreviousClocks) / (currentTime - speedPreviousTime) / 1000;
			elems.currentSpeedDisplay.textContent = Math.max(currentSpeed, 0).toFixed(3);
			speedPreviousTime = currentTime;
			speedPreviousClocks = elapsedClocks;
		}
		requestAnimationFrame(tick);
	};
	tick();
});
