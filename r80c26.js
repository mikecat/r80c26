"use strict";

class R80C26 {
	// [B, C, D, E, H, L, F, A, B', C', D', E', H', L', F', A', I, R]
	#regs8bit = new Uint8Array(18);
	#regs8bitView = null;
	// [IX, IY, SP, PC]
	#regs16bit = new Uint16Array(4);
	#IFF1 = 0;
	#IFF2 = 0;
	#IMF = 0;
	#halted = false;

	get A() { return this.#regs8bit[7]; }
	set A(value) { this.#regs8bit[7] = value; }
	get F() { return this.#regs8bit[6]; }
	set F(value) { this.#regs8bit[6] = value; }
	get B() { return this.#regs8bit[0]; }
	set B(value) { this.#regs8bit[0] = value; }
	get C() { return this.#regs8bit[1]; }
	set C(value) { this.#regs8bit[1] = value; }
	get D() { return this.#regs8bit[2]; }
	set D(value) { this.#regs8bit[2] = value; }
	get E() { return this.#regs8bit[3]; }
	set E(value) { this.#regs8bit[3] = value; }
	get H() { return this.#regs8bit[4]; }
	set H(value) { this.#regs8bit[4] = value; }
	get L() { return this.#regs8bit[5]; }
	set L(value) { this.#regs8bit[5] = value; }
	get Ap() { return this.#regs8bit[15]; }
	set Ap(value) { this.#regs8bit[15] = value; }
	get Fp() { return this.#regs8bit[14]; }
	set Fp(value) { this.#regs8bit[14] = value; }
	get Bp() { return this.#regs8bit[8]; }
	set Bp(value) { this.#regs8bit[8] = value; }
	get Cp() { return this.#regs8bit[9]; }
	set Cp(value) { this.#regs8bit[9] = value; }
	get Dp() { return this.#regs8bit[10]; }
	set Dp(value) { this.#regs8bit[10] = value; }
	get Ep() { return this.#regs8bit[11]; }
	set Ep(value) { this.#regs8bit[11] = value; }
	get Hp() { return this.#regs8bit[12]; }
	set Hp(value) { this.#regs8bit[12] = value; }
	get Lp() { return this.#regs8bit[13]; }
	set Lp(value) { this.#regs8bit[13] = value; }
	get I() { return this.#regs8bit[16]; }
	set I(value) { this.#regs8bit[16] = value; }
	get R() { return this.#regs8bit[17]; }
	set R(value) { this.#regs8bit[17] = value; }

	get AF() { return this.#regs8bitView.getUint16(6, true); }
	set AF(value) { this.#regs8bitView.setUint16(6, value, true); }
	get BC() { return this.#regs8bitView.getUint16(0, false); }
	set BC(value) { this.#regs8bitView.setUint16(0, value, false); }
	get DE() { return this.#regs8bitView.getUint16(2, false); }
	set DE(value) { this.#regs8bitView.setUint16(2, value, false); }
	get HL() { return this.#regs8bitView.getUint16(4, false); }
	set HL(value) { this.#regs8bitView.setUint16(4, value, false); }

	get IX() { return this.#regs16bit[0]; }
	set IX(value) { this.#regs16bit[0] = value; }
	get IY() { return this.#regs16bit[1]; }
	set IY(value) { this.#regs16bit[1] = value; }
	get SP() { return this.#regs16bit[2]; }
	set SP(value) { this.#regs16bit[2] = value; }
	get PC() { return this.#regs16bit[3]; }
	set PC(value) { this.#regs16bit[3] = value; }

	get IFF1() { return this.#IFF1; }
	set IFF1(value) { this.#IFF1 = value ? 1 : 0; }
	get IFF2() { return this.#IFF2; }
	set IFF2(value) { this.#IFF2 = value ? 1 : 0; }
	get IMF() { return this.#IMF; }
	set IMF(value) {
		if (value === 0 || value === 1 || value === 2) this.#IMF = value;
	}

	get halted() { return this.#halted; }

	#readMemoryRaw = null;
	#writeMemory = null;
	#readIORaw = null;
	#writeIO = null;

	#readMemory(addr) { return this.#readMemoryRaw(addr) & 0xff; }
	#readIO(addr) { return this.#readIORaw(addr) & 0xff; }

	// readMemory：(アドレス) を受け取り、そのアドレスのメモリからデータ (8ビット) を読んで返す
	// writeMemory：(アドレス, データ) を受け取り、そのアドレスのメモリにそのデータ (8ビット) を書き込む
	// readIO：(アドレス）を受け取り、そのアドレスのI/Oからデータ (8ビット) を読んで返す
	// writeIO：(アドレス, データ) を受け取り、そのアドレスのI/Oにそのデータ (8ビット) を書き込む
	constructor(readMemory, writeMemory, readIO, writeIO) {
		this.#regs8bitView = new DataView(this.#regs8bit.buffer, this.#regs8bit.byteOffset, this.#regs8bit.byteLength);
		this.#readMemoryRaw = readMemory || (() => 0xff);
		this.#writeMemory = writeMemory || (() => {});
		this.#readIORaw = readIO || (() => 0xff);
		this.#writeIO = writeIO || (() => {});
	}

	// CPUをリセットする
	reset() {
		// IFF1, IFF2, PC, I, R, IMF については、リセット時に0にすることがUM0080で明示されている
		// TODO：その他のレジスタは？
		for (let i = 0; i < this.#regs8bit.length; i++) this.#regs8bit[i] = 0;
		for (let i = 0; i < this.#regs16bit.length; i++) this.#regs16bit[i] = 0;
		this.#IFF1 = 0;
		this.#IFF2 = 0;
		this.#IMF = 0;
		this.#halted = false;
	}

	// 1命令実行し、かかったクロック数を返す
	step() {
		const currentPC = this.PC;
		const fetchedInstruction = [];
		const fetchInst = (offset) => {
			const inst = this.#readMemory((currentPC + offset) & 0xffff);
			fetchedInstruction.push(inst);
			return inst;
		};
		let nextPC = null, deltaR = null, deltaClock = null;
		const setInsnInfo = (nextPcOffset, _deltaR, _deltaClock) => {
			nextPC = (currentPC + nextPcOffset) & 0xffff;
			deltaR = _deltaR;
			deltaClock = _deltaClock;
		};

		const firstInsn = fetchInst(0);
		if (this.#halted) {
			setInsnInfo(0, 1, 4);
		} else {
			const firstInsnHigh = (firstInsn >> 6) & 3;
			const firstInsnMiddle = (firstInsn >> 3) & 7;
			const firstInsnLow = firstInsn & 7;
			switch (firstInsnHigh) {
				case 0:
					switch (firstInsnLow) {
						case 0:
							switch (firstInsnMiddle) {
								case 0: // NOP
									setInsnInfo(1, 1, 4);
									break;
								case 1: // EX AF, AF'
									{
										const tempA = this.A;
										const tempF = this.F;
										this.A = this.Ap;
										this.F = this.Fp;
										this.Ap = tempA;
										this.Fp = tempF;
										setInsnInfo(1, 1, 4);
									}
									break;
								case 2: // DJNZ, e
								case 3: // JR e
								case 4: // JR NZ, e
								case 5: // JR Z, e
								case 6: // JP NC, e
								case 7: // JR C, e
									{
										const e = fetchInst(1);
										const dst = (currentPC + 2 + (e | (e & 0x80 ? 0xff00 : 0))) & 0xffff;
										let taken = false;
										switch (firstInsnMiddle) {
											case 2: taken = --this.B; break;
											case 3: taken = true; break;
											case 4: taken = !(this.F & 0x40); break;
											case 5: taken = this.F & 0x40; break;
											case 6: taken = !(this.F & 0x01); break;
											case 7: taken = this.F & 0x01; break;
										}
										setInsnInfo(2, 1, 7);
										if (taken) {
											nextPC = dst;
											deltaClock = 12;
										}
										if (firstInsnMiddle === 2) deltaClock++;
									}
									break;
							}
							break;
						case 1:
							if (firstInsnMiddle & 1) { // ADD HL, ss
								const src = firstInsnMiddle >> 1;
								const srcValue = src === 3 ? this.SP : this.#regs8bitView.getUint16(src * 2, false);
								const halfValue = (this.HL & 0x0fff) + (srcValue & 0x0fff);
								const value = this.HL + srcValue;
								this.HL = value;
								this.F = (this.F & 0xec) |
									(halfValue >= 0x1000 ? 0x10 : 0) |
									(value >= 0x10000 ? 0x01 : 0);
								setInsnInfo(1, 1, 11);
							} else { // LD dd, nn
								const dst = firstInsnMiddle >> 1;
								const valueLow = fetchInst(1);
								const valueHigh = fetchInst(2);
								const value = (valueHigh << 8) | valueLow;
								setInsnInfo(3, 1, 10);
								if (dst === 3) {
									this.SP = value;
								} else {
									this.#regs8bitView.setUint16(dst * 2, value, false);
								}
							}
							break;
						case 2:
							switch (firstInsnMiddle) {
								case 0: // LD (BC), A
								case 1: // LD A, (BC)
								case 2: // LD (DE), A
								case 3: // LD A, (DE)
									setInsnInfo(1, 1, 7);
									switch (firstInsnMiddle) {
										case 0: this.#writeMemory(this.BC, this.A); break;
										case 1: this.A = this.#readMemory(this.BC); break;
										case 2: this.#writeMemory(this.DE, this.A); break;
										case 3: this.A = this.#readMemory(this.DE); break;
									}
									break;
								case 4: // LD (nn), HL
								case 5: // LD HL, (nn)
								case 6: // LD (nn), A
								case 7: // LD A, (nn)
									{
										const addrLow = fetchInst(1);
										const addrHigh = fetchInst(2);
										const addr = (addrHigh << 8) | addrLow;
										switch (firstInsnMiddle) {
											case 4:
												this.#writeMemory(addr, this.L);
												this.#writeMemory((addr + 1) & 0xffff, this.H);
												setInsnInfo(3, 1, 16);
												break;
											case 5:
												this.L = this.#readMemory(addr);
												this.H = this.#readMemory((addr + 1) & 0xffff);
												setInsnInfo(3, 1, 16);
												break;
											case 6:
												this.#writeMemory(addr, this.A);
												setInsnInfo(3, 1, 13);
												break;
											case 7:
												this.A = this.#readMemory(addr);
												setInsnInfo(3, 1, 13);
												break;
										}
									}
									break;
							}
							break;
						case 3:
							{
								const target = firstInsnMiddle >> 1;
								setInsnInfo(1, 1, 6);
								if (firstInsnMiddle & 1) { // DEC ss
									if (target === 3) {
										this.SP--;
									} else {
										const value = this.#regs8bitView.getUint16(target * 2, false);
										this.#regs8bitView.setUint16(target * 2, value - 1, false);
									}
								} else { // INC ss
									if (target === 3) {
										this.SP++;
									} else {
										const value = this.#regs8bitView.getUint16(target * 2, false);
										this.#regs8bitView.setUint16(target * 2, value + 1, false);
									}
								}
							}
							break;
						case 4: // INC r / INC (HL)
							{
								const target = firstInsnMiddle;
								const value = target === 6 ? this.#readMemory(this.HL) : this.#regs8bit[target];
								const result = (value + 1) & 0xff;
								this.F = (this.F & 0x29) |
									(result & 0x80 ? 0x80 : 0) |
									(result === 0 ? 0x40 : 0) |
									((value & 0x0f) === 0xf ? 0x10 : 0) |
									(value === 0x7f ? 0x04 : 0);
								if (target === 6) {
									this.#writeMemory(this.HL, result);
									setInsnInfo(1, 1, 11);
								} else {
									this.#regs8bit[target] = result;
									setInsnInfo(1, 1, 4);
								}
							}
							break;
						case 5: // DEC r / DEC (HL)
							{
								const target = firstInsnMiddle;
								const value = target === 6 ? this.#readMemory(this.HL) : this.#regs8bit[target];
								const result = (value - 1) & 0xff;
								this.F = (this.F & 0x29) |
									(result & 0x80 ? 0x80 : 0) |
									(result === 0 ? 0x40 : 0) |
									((value & 0x0f) === 0x0 ? 0x10 : 0) |
									(value === 0x80 ? 0x04 : 0) |
									0x02;
								if (target === 6) {
									this.#writeMemory(this.HL, result);
									setInsnInfo(1, 1, 11);
								} else {
									this.#regs8bit[target] = result;
									setInsnInfo(1, 1, 4);
								}
							}
							break;
						case 6: // LD r, n / LD (HL), n
							{
								const dst = firstInsnMiddle;
								const value = fetchInst(1);
								if (dst === 6) {
									this.#writeMemory(this.HL, value);
									setInsnInfo(2, 1, 10);
								} else {
									this.#regs8bit[dst] = value;
									setInsnInfo(2, 1, 7);
								}
							}
							break;
					}
					break;
				case 1:
					{
						const src = firstInsnLow;
						const dst = firstInsnMiddle;
						setInsnInfo(1, 1, 4);
						if (src === 6 && dst === 6) { // HALT
							this.#halted = true;
						} else { // LD r, r' / LD r, (HL) / LD (HL), r
							let data;
							if (src === 6) {
								data = this.#readMemory(this.HL);
								deltaClock = 7;
							} else {
								data = this.#regs8bit[src];
							}
							if (dst === 6) {
								this.#writeMemory(this.HL, data);
								deltaClock = 7;
							} else {
								this.#regs8bit[dst] = data;
							}
						}
					}
					break;
				case 2:
					break;
				case 3:
					break;
			}
		}

		if (nextPC === null || deltaR === null || deltaClock === null) {
			const insn = fetchedInstruction.map((e) => {
				const eStr = "0" + e.toString(16);
				return eStr.substring(eStr.length - 2);
			}).join(" ");
			throw new Error("not implemented: " + insn);
		}
		this.PC = nextPC;
		this.R = (this.R & 0x80) | ((this.R + deltaR) & 0x7f);
		return deltaClock;
	}
}
