"use strict";

window.addEventListener("DOMContentLoaded", () => {
	const elems = {};
	document.querySelectorAll("[id]").forEach((e) => elems[e.id] = e);

	const ROM_START = 0x0000;
	const RAM_START = 0x8000;

	let ROM = new Uint8Array(0);
	let RAM = new Uint8Array(0);
	let RAMdirty = new Uint8Array(0);
	const ROMViewerCache = { address: new Map(), byte: new Map(), chars: new Map() };
	const RAMViewerCache = { address: new Map(), byte: new Map(), chars: new Map() };

	const readMemory = (address) => {
		if (ROM_START <= address && address < ROM_START + ROM.length) {
			return ROM[address - ROM_START];
		} else if (RAM_START <= address && address < RAM_START + RAM.length) {
			return RAM[address - RAM_START];
		}
		return 0xff;
	};

	const writeMemory = (address, data) => {
		if (RAM_START <= address && address < RAM_START + RAM.length) {
			RAM[address - RAM_START] = data;
			RAMdirty[address - RAM_START] = 1;
		}
	};

	const CPU = new R80C26(readMemory, writeMemory);
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
					}
					const byteString = address < data.length ? "0" + data[address].toString(16) : "  ";
					byteElement.textContent = byteString.substring(byteString.length - 2);
					if (dirty && address < dirty.length) dirty[address] = 0;
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
		CPU[registerName] = value;
	};
	const setFlag = (element, flagBit) => {
		if (element.checked) {
			CPU.F |= 1 << flagBit;
		} else {
			CPU.F &= ~(1 << flagBit);
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
	elems.registerInputIFF1.addEventListener("change", () => CPU.IFF1 = elems.registerInputIFF1.checked);
	elems.registerInputIFF2.addEventListener("change", () => CPU.IFF2 = elems.registerInputIFF2.checked);
	elems.registerInputIMF_0.addEventListener("change", () => CPU.IMF = 0);
	elems.registerInputIMF_1.addEventListener("change", () => CPU.IMF = 1);
	elems.registerInputIMF_2.addEventListener("change", () => CPU.IMF = 2);
	elems.flagInputS.addEventListener("change", () => setFlag(elems.flagInputS, 7));
	elems.flagInputZ.addEventListener("change", () => setFlag(elems.flagInputZ, 6));
	elems.flagInputH.addEventListener("change", () => setFlag(elems.flagInputH, 4));
	elems.flagInputPV.addEventListener("change", () => setFlag(elems.flagInputPV, 2));
	elems.flagInputN.addEventListener("change", () => setFlag(elems.flagInputN, 1));
	elems.flagInputC.addEventListener("change", () => setFlag(elems.flagInputC, 0));

	const setValueIfNotFocused = (element, value) => {
		if (document.activeElement !== element) element.value = value;
	};

	const renderStatus = () => {
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
		setValueIfNotFocused(elems.registerInputA, render8bit(CPU.A));
		setValueIfNotFocused(elems.registerInputF, render8bit(CPU.F));
		setValueIfNotFocused(elems.registerInputB, render8bit(CPU.B));
		setValueIfNotFocused(elems.registerInputC, render8bit(CPU.C));
		setValueIfNotFocused(elems.registerInputD, render8bit(CPU.D));
		setValueIfNotFocused(elems.registerInputE, render8bit(CPU.E));
		setValueIfNotFocused(elems.registerInputH, render8bit(CPU.H));
		setValueIfNotFocused(elems.registerInputL, render8bit(CPU.L));
		setValueIfNotFocused(elems.registerInputAp, render8bit(CPU.Ap));
		setValueIfNotFocused(elems.registerInputFp, render8bit(CPU.Fp));
		setValueIfNotFocused(elems.registerInputBp, render8bit(CPU.Bp));
		setValueIfNotFocused(elems.registerInputCp, render8bit(CPU.Cp));
		setValueIfNotFocused(elems.registerInputDp, render8bit(CPU.Dp));
		setValueIfNotFocused(elems.registerInputEp, render8bit(CPU.Ep));
		setValueIfNotFocused(elems.registerInputHp, render8bit(CPU.Hp));
		setValueIfNotFocused(elems.registerInputLp, render8bit(CPU.Lp));
		setValueIfNotFocused(elems.registerInputI, render8bit(CPU.I));
		setValueIfNotFocused(elems.registerInputR, render8bit(CPU.R));
		setValueIfNotFocused(elems.registerInputIX, render16bit(CPU.IX));
		setValueIfNotFocused(elems.registerInputIY, render16bit(CPU.IY));
		setValueIfNotFocused(elems.registerInputBC, render16bit(CPU.BC));
		setValueIfNotFocused(elems.registerInputDE, render16bit(CPU.DE));
		setValueIfNotFocused(elems.registerInputHL, render16bit(CPU.HL));
		setValueIfNotFocused(elems.registerInputSP, renderSpPc(CPU.SP));
		setValueIfNotFocused(elems.registerInputPC, renderSpPc(CPU.PC));
		elems.registerInputIFF1.checked = CPU.IFF1;
		elems.registerInputIFF2.checked = CPU.IFF2;
		elems.registerInputIMF_0.checked = CPU.IMF === 0;
		elems.registerInputIMF_1.checked = CPU.IMF === 1;
		elems.registerInputIMF_2.checked = CPU.IMF === 2;
		elems.flagInputS.checked = CPU.F & 0x80;
		elems.flagInputZ.checked = CPU.F & 0x40;
		elems.flagInputH.checked = CPU.F & 0x10;
		elems.flagInputPV.checked = CPU.F & 0x04;
		elems.flagInputN.checked = CPU.F & 0x02;
		elems.flagInputC.checked = CPU.F & 0x01;
	};

	const tick = (currentTime) => {
		if (clockBudget > 0) clockBudget = 0;
		if (running) {
			if (budgetPreviousTime !== null) {
				clockBudget += Math.max(0, targetSpeed * (currentTime - budgetPreviousTime) * 1000);
			}
			const finishTime = currentTime + 2000;
			budgetPreviousTime = currentTime;
			while (clockBudget > 0 && (elapsedSteps % 10000 !== 0 || performance.now() < finishTime)) {
				const clocksDelta = CPU.step();
				elapsedSteps++;
				elapsedClocks += clocksDelta;
				clockBudget -= clocksDelta;
			}
		}
		renderStatus();
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

	elems.runButton.addEventListener("click", () => setRunning(true));
	elems.pauseButton.addEventListener("click", () => setRunning(false));
	elems.stepButton.addEventListener("click", () => {
		elapsedClocks += CPU.step();
		elapsedSteps++;
	});
	elems.resetButton.addEventListener("click", () => {
		setRunning(false);
		CPU.reset();
		for (let i = 0; i < RAM.length; i++) {
			RAM[i] = 0xff;
			RAMdirty[i] = 1;
		}
		elapsedSteps = 0;
		elapsedClocks = 0;
	});

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
});
