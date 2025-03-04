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
	get AFp() { return this.#regs8bitView.getUint16(14, true); }
	set AFp(value) { this.#regs8bitView.setUint16(14, value, true); }
	get BCp() { return this.#regs8bitView.getUint16(8, false); }
	set BCp(value) { this.#regs8bitView.setUint16(8, value, false); }
	get DEp() { return this.#regs8bitView.getUint16(10, false); }
	set DEp(value) { this.#regs8bitView.setUint16(10, value, false); }
	get HLp() { return this.#regs8bitView.getUint16(12, false); }
	set HLp(value) { this.#regs8bitView.setUint16(12, value, false); }

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

	static #isEvenParity8bit(value) {
		value ^= value >> 1;
		value ^= value >> 2;
		value ^= value >> 4;
		return !(value & 1);
	}

	// Aレジスタと値valueの演算を行い、Aレジスタとフラグを更新する
	#arith8bit(value, kind) {
		switch (kind) {
			case 0: // ADD
			case 1: // ADC
			case 2: // SUB
			case 3: // SBC
			case 7: // CP
				{
					const isAdd = kind === 0 || kind === 1;
					const useCarry = kind === 1 || kind === 3;
					const a = this.A;
					const b = (isAdd ? value : ~value) & 0xff;
					const c = ((useCarry ? this.F : 0) ^ (isAdd ? 0 : 1)) & 1;
					const sum = a + b + c;
					const halfSum = (a & 0xf) + (b & 0xf) + c;
					const carry = sum & 0x100;
					const halfCarry = halfSum & 0x10;
					const overflow = (a & 0x80) === (b & 0x80) && (a & 0x80) !== (sum & 0x80);
					this.F = (this.F & 0x28) |
						(sum & 0x80) |
						((sum & 0xff) === 0 ? 0x40 : 0) |
						((isAdd ? halfCarry : !halfCarry) ? 0x10 : 0) |
						(overflow ? 0x04 : 0) |
						(isAdd ? 0 : 0x02) |
						((isAdd ? carry : !carry) ? 0x01 : 0);
					if (kind !== 7) this.A = sum;
				}
				break;
			case 4: // AND
			case 5: // XOR
			case 6: // OR
				{
					const res =
						kind === 4 ? this.A & value :
						kind === 5 ? this.A ^ value :
						this.A | value;
					this.A = res;
					this.F = (this.F & 0x28) |
						(res & 0x80) |
						(res === 0 ? 0x40 : 0) |
						(kind === 4 ? 0x10 : 0) |
						(R80C26.#isEvenParity8bit(res) ? 0x04 : 0);
				}
				break;
		}
	}

	#checkCondition(cc) {
		let mask = 0;
		switch (cc & 6) {
			case 0: mask = 0x40; break; // Z
			case 2: mask = 0x01; break; // C
			case 4: mask = 0x04; break; // P/V
			case 6: mask = 0x80; break; // S
		}
		const flag = this.F & mask;
		return cc & 1 ? flag : !flag;
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
		let preventSampleInterrupt = false;

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
									(result & 0x80) |
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
									(result & 0x80) |
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
						case 7:
							switch (firstInsnMiddle) {
								case 0: // RLCA
									this.F = (this.F & 0xec) | (this.A >> 7);
									this.A = (this.A << 1) | (this.A >> 7);
									setInsnInfo(1, 1, 4);
									break;
								case 1: // RRCA
									this.F = (this.F & 0xec) | (this.A & 0x01);
									this.A = (this.A >> 1) | (this.A << 7);
									setInsnInfo(1, 1, 4);
									break;
								case 2: // RLA
									{
										const carry = this.F & 1;
										this.F = (this.F & 0xec) | (this.A >> 7);
										this.A = (this.A << 1) | carry;
										setInsnInfo(1, 1, 4);
									}
									break;
								case 3: // RRA
									{
										const carry = this.F & 1;
										this.F = (this.F & 0xec) | (this.A & 0x01);
										this.A = (this.A >> 1) | (carry << 7);
										setInsnInfo(1, 1, 4);
									}
									break;
								case 4: // DAA
									{
										const curA = this.A, curF = this.F;
										const Alower = curA & 0xf;
										const curN = curF & 2, curC = curF & 1, curH = curF & 0x10;
										let Adelta = 0, newC = 0, newH = 0;
										if (curN) {
											if (curC || curA >= 0x9a) {
												Adelta = 0x9a;
												newC = 1;
											} else {
												Adelta = 0xfa;
												newC = 0;
											}
											if (!curH && Alower <= 9) Adelta += 6;
											newH = curH && Alower <= 5 ? 1 : 0;
										} else {
											if (curC || curA >= 0x9a) {
												Adelta = 0x60;
												newC = 1;
											} else {
												Adelta = 0x00;
												newC = 0;
											}
											if (curH || Alower >= 0xa) Adelta += 6;
											newH = Alower >= 0xa ? 1 : 0;
										}
										const newA = (curA + Adelta) & 0xff;
										this.A = newA;
										this.F = (curF & 0x2a) |
											(newA & 0x80) |
											(newA === 0 ? 0x40 : 0) |
											(newH << 4) |
											(R80C26.#isEvenParity8bit(newA) ? 0x04 : 0) |
											newC;
										setInsnInfo(1, 1, 4);
									}
									break;
								case 5: // CPL
									this.A = ~this.A;
									this.F |= 0x12;
									setInsnInfo(1, 1, 4);
									break;
								case 6: // SCF
									this.F = (this.F & 0xec) | 0x01;
									setInsnInfo(1, 1, 4);
									break;
								case 7: // CCF
									this.F = (this.F & 0xec) | (this.F & 0x01 ? 0x10 : 0x01);
									setInsnInfo(1, 1, 4);
									break;
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
				case 2: // ADD/ADC/SUB/SBC/AND/OR/XOR/CP A, r/(HL)
					{
						const src = firstInsnLow;
						const value = src === 6 ? this.#readMemory(this.HL) : this.#regs8bit[src];
						setInsnInfo(1, 1, src === 6 ? 7 : 4);
						this.#arith8bit(value, firstInsnMiddle);
					}
					break;
				case 3:
					switch (firstInsnLow) {
						case 0: // RET cc
							{
								const taken = this.#checkCondition(firstInsnMiddle);
								if (taken) {
									const newPcLow = this.#readMemory(this.SP);
									const newPcHigh = this.#readMemory((this.SP + 1) & 0xffff);
									this.SP += 2;
									setInsnInfo(0, 1, 11);
									nextPC = newPcLow | (newPcHigh << 8);
								} else {
									setInsnInfo(1, 1, 5);
								}
							}
							break;
						case 1:
							if ((firstInsnMiddle & 1) === 0) { // POP qq
								const valueLow = this.#readMemory(this.SP);
								const valueHigh = this.#readMemory((this.SP + 1) & 0xffff);
								const value = valueLow | (valueHigh << 8);
								this.SP += 2;
								if (firstInsnMiddle === 6) {
									this.AF = value;
								} else {
									this.#regs8bitView.setUint16(firstInsnMiddle, value, false);
								}
								setInsnInfo(1, 1, 10);
							} else {
								switch (firstInsnMiddle) {
									case 1: // RET
										{
											const newPcLow = this.#readMemory(this.SP);
											const newPcHigh = this.#readMemory((this.SP + 1) & 0xffff);
											this.SP += 2;
											setInsnInfo(0, 1, 10);
											nextPC = newPcLow | (newPcHigh << 8);
										}
										break;
									case 3: // EXX
										{
											let temp;
											temp = this.BC; this.BC = this.BCp; this.BCp = temp;
											temp = this.DE; this.DE = this.DEp; this.DEp = temp;
											temp = this.HL; this.HL = this.HLp; this.HLp = temp;
											setInsnInfo(1, 1, 4);
										}
										break;
									case 5: // JP (HL)
										setInsnInfo(0, 1, 4);
										nextPC = this.HL;
										break;
									case 7: // LD SP, HL
										this.SP = this.HL;
										setInsnInfo(1, 1, 6);
										break;
								}
							}
							break;
						case 2: // JP cc, nn
							{
								const destLow = fetchInst(1);
								const destHigh = fetchInst(2);
								const taken = this.#checkCondition(firstInsnMiddle);
								setInsnInfo(3, 1, 10);
								if (taken) nextPC = destLow | (destHigh << 8);
							}
							break;
						case 3:
							switch (firstInsnMiddle) {
								case 0: // JP nn
									{
										const destLow = fetchInst(1);
										const destHigh = fetchInst(2);
										setInsnInfo(3, 1, 10);
										nextPC = destLow | (destHigh << 8);
									}
									break;
								case 1:
									{
										const secondInsn = fetchInst(1);
										const secondInsnUpper = secondInsn >> 6;
										if (secondInsnUpper === 0) {
											const kind = (secondInsn >> 3) & 7;
											if (kind !== 6) { // RLC/RL/RRC/RR/SLA/SRA/SRL r/(HL)
												const target = secondInsn & 7;
												const srcValue = target === 6 ? this.#readMemory(this.HL) : this.#regs8bit[target];
												const carry = this.F & 1;
												let value = 0, newCarry = 0;
												switch (kind) {
													case 0: // RLC
														value = ((srcValue << 1) | (srcValue >> 7)) & 0xff;
														newCarry = srcValue & 0x80;
														break;
													case 1: // RRC
														value = ((srcValue >> 1) | (srcValue << 7)) & 0xff;
														newCarry = srcValue & 1;
														break;
													case 2: // RL
														value = ((srcValue << 1) | carry) & 0xff;
														newCarry = srcValue & 0x80;
														break;
													case 3: // RR
														value = ((srcValue >> 1) | (carry << 7)) & 0xff;
														newCarry = srcValue & 1;
														break;
													case 4: // SLA
														value = (srcValue << 1) & 0xff;
														newCarry = srcValue & 0x80;
														break;
													case 5: // SRA
														value = (srcValue & 0x80) | (srcValue >> 1);
														newCarry = srcValue & 1;
														break;
													case 7: // SRL
														value = srcValue >> 1;
														newCarry = srcValue & 1;
														break;
												}
												this.F = (this.F & 0x28) |
													(value & 0x80) |
													(value === 0 ? 0x40 : 0) |
													(R80C26.#isEvenParity8bit(value) ? 0x04 : 0) |
													(newCarry ? 0x01 : 0);
												if (target === 6) {
													this.#writeMemory(this.HL, value);
													setInsnInfo(2, 2, 15);
												} else {
													this.#regs8bit[target] = value;
													setInsnInfo(2, 2, 8);
												}
											}
										} else { // BIT/SET/RES b, r/(HL)
											const target = secondInsn & 7;
											const bit = (secondInsn >> 3) & 7;
											const srcValue = target === 6 ? this.#readMemory(this.HL) : this.#regs8bit[target];
											if (secondInsnUpper === 1) { // BIT
												this.F = (this.F & 0xad) | ((srcValue >> bit) & 1 ? 0 : 0x40) | 0x10;
												setInsnInfo(2, 2, target === 6 ? 12 : 8);
											} else { // SET/RES
												const value = secondInsnUpper === 3 ? srcValue | (1 << bit) : srcValue & ~(1 << bit);
												if (target === 6) {
													this.#writeMemory(this.HL, value);
													setInsnInfo(2, 2, 15);
												} else {
													this.#regs8bit[target] = value;
													setInsnInfo(2, 2, 8);
												}
											}
										}
									}
									break;
								case 2: // OUT (n), A
									{
										const addr = fetchInst(1);
										this.#writeIO((this.A << 8) | addr, this.A);
										setInsnInfo(2, 1, 11);
									}
									break;
								case 3: // IN A, (n)
									{
										const addr = fetchInst(1);
										this.A = this.#readIO((this.A << 8) | addr);
										setInsnInfo(2, 1, 11);
									}
									break;
								case 4: // EX (SP), HL
									{
										const tempH = this.H, tempL = this.L;
										const lowAddress = this.SP;
										const highAddress = (lowAddress + 1) & 0xffff;
										this.L = this.#readMemory(lowAddress);
										this.H = this.#readMemory(highAddress);
										this.#writeMemory(highAddress, tempH);
										this.#writeMemory(lowAddress, tempL);
										setInsnInfo(1, 1, 19);
									}
									break;
								case 5: // EX DE, HL
									{
										const temp = this.DE;
										this.DE = this.HL;
										this.HL = temp;
										setInsnInfo(1, 1, 4);
									}
									break;
								case 6: // DI
									this.IFF1 = 0;
									this.IFF2 = 0;
									preventSampleInterrupt = true;
									setInsnInfo(1, 1, 4);
									break;
								case 7: // EI
									this.IFF1 = 1;
									this.IFF2 = 1;
									preventSampleInterrupt = true;
									setInsnInfo(1, 1, 4);
									break;
							}
							break;
						case 4: // CALL cc, nn
							{
								const destLow = fetchInst(1);
								const destHigh = fetchInst(2);
								const taken = this.#checkCondition(firstInsnMiddle);
								if (taken) {
									const pcToSave = (currentPC + 3) & 0xffff;
									this.SP -= 2;
									this.#writeMemory((this.SP + 1) & 0xffff, pcToSave >> 8);
									this.#writeMemory(this.SP, pcToSave & 0xff);
									setInsnInfo(3, 1, 17);
									nextPC = destLow | (destHigh << 8);
								} else {
									setInsnInfo(3, 1, 10);
								}
							}
							break;
						case 5:
							if ((firstInsnMiddle & 1) === 0) { // PUSH qq
								const value = firstInsnMiddle === 6 ? this.AF : this.#regs8bitView.getUint16(firstInsnMiddle, false);
								this.SP -= 2;
								this.#writeMemory((this.SP + 1) & 0xffff, value >> 8);
								this.#writeMemory(this.SP, value & 0xff);
								setInsnInfo(1, 1, 11);
							} else {
								switch (firstInsnMiddle) {
									case 1: // CALL nn
										{
											const destLow = fetchInst(1);
											const destHigh = fetchInst(2);
											const pcToSave = (currentPC + 3) & 0xffff;
											this.SP -= 2;
											this.#writeMemory((this.SP + 1) & 0xffff, pcToSave >> 8);
											this.#writeMemory(this.SP, pcToSave & 0xff);
											setInsnInfo(3, 1, 17);
											nextPC = destLow | (destHigh << 8);
										}
										break;
									case 3: // 0xDD
									case 7: // 0xFD
										{
											const secondInsn = fetchInst(1);
											const secondInsnUpper = secondInsn >> 6;
											const secondInsnMiddle = (secondInsn >> 3) & 7;
											const secondInsnLower = secondInsn & 7;
											let regValue = firstInsnMiddle === 7 ? this.IY : this.IX;
											switch (secondInsnUpper) {
												case 0:
													if (secondInsnLower === 1 && (secondInsnMiddle & 1)) { // ADD IX, pp / ADD IY, rr
														let value = 0;
														switch (secondInsnMiddle) {
															case 1: value = this.BC; break;
															case 3: value = this.DE; break;
															case 5: value = regValue; break;
															case 7: value = this.SP; break;
														}
														const result = regValue + value;
														const resultHalf = (regValue & 0xfff) + (value & 0xfff);
														this.F = (this.F & 0xec) |
															(resultHalf & 0x1000 ? 0x10 : 0) |
															(result & 0x10000 ? 0x01 : 0);
														regValue = result;
														setInsnInfo(2, 2, 15);
													} else {
														switch (secondInsn) {
															case 0x21: // LD IX/IY, nn
															case 0x22: // LD (nn), IX/IY
															case 0x2a: // LD IX/IY, (nn)
																{
																	const valueLower = fetchInst(2);
																	const valueUpper = fetchInst(3);
																	const value = valueLower | (valueUpper << 8);
																	switch (secondInsn) {
																		case 0x21:
																			regValue = value;
																			setInsnInfo(4, 2, 14);
																			break;
																		case 0x22:
																			this.#writeMemory(value, regValue & 0xff);
																			this.#writeMemory((value + 1) & 0xffff, regValue >> 8);
																			setInsnInfo(4, 2, 20);
																			break;
																		case 0x2a:
																			{
																				const loadedLower = this.#readMemory(value);
																				const loadedUpper = this.#readMemory((value + 1) & 0xffff);
																				regValue = loadedLower | (loadedUpper << 8);
																				setInsnInfo(4, 2, 20);
																			}
																			break;
																	}
																}
																break;
															case 0x23: // INC IX/IY
																regValue = (regValue + 1) & 0xffff;
																setInsnInfo(2, 2, 10);
																break;
															case 0x2b: // DEC IX/IY
																regValue = (regValue - 1) & 0xffff;
																setInsnInfo(2, 2, 10);
																break;
															case 0x34: // INC (IX/IY+d)
															case 0x35: // DEC (IX/IY+d)
															case 0x36: // LD (IX/IY+d), n
																{
																	const dRaw = fetchInst(2);
																	const d = dRaw & 0x80 ? dRaw - 0x100 : dRaw;
																	const addr = (regValue + d) & 0xffff;
																	let calcValue = null;
																	switch (secondInsn) {
																		case 0x34: // INC
																			{
																				const srcValue = this.#readMemory(addr);
																				calcValue = (srcValue + 1) & 0xff;
																				const carryHalf = (srcValue & 0xf) + 1;
																				this.F = (this.F & 0xd9) |
																					(calcValue & 0x80) |
																					(calcValue === 0 ? 0x40 : 0) |
																					(carryHalf & 0x10) |
																					(srcValue === 0x7f ? 0x04 : 0);
																				setInsnInfo(3, 2, 23);
																			}
																			break;
																		case 0x35: // DEC
																			{
																				const srcValue = this.#readMemory(addr);
																				calcValue = (srcValue - 1) & 0xff;
																				const carryHalf = (~srcValue & 0xf) + 1;
																				this.F = (this.F & 0xd9) |
																					(calcValue & 0x80) |
																					(calcValue === 0 ? 0x40 : 0) |
																					(carryHalf & 0x10 ? 0 : 0x10) |
																					(srcValue === 0x80 ? 0x04 : 0) |
																					0x02;
																				setInsnInfo(3, 2, 23);
																			}
																			break;
																		case 0x36: // LD
																			calcValue = fetchInst(3);
																			setInsnInfo(4, 2, 19);
																			break;
																	}
																	if (calcValue !== null) {
																		this.#writeMemory(addr, calcValue);
																	}
																}
																break;
														}
													}
													break;
												case 1:
													if (secondInsnLower === 6) { // LD r, (IX/IY+d)
														if (secondInsnMiddle !== 6) {
															const dRaw = fetchInst(2);
															const d = dRaw & 0x80 ? dRaw - 0x100 : dRaw;
															const addr = (regValue + d) & 0xffff;
															this.#regs8bit[secondInsnMiddle] = this.#readMemory(addr);
															setInsnInfo(3, 2, 19);
														}
													} else if (secondInsnMiddle === 6) { // LD (IX/IY+d), r
														// 上の条件分岐より、secondInsnLower !== 6 を満たす
														const dRaw = fetchInst(2);
														const d = dRaw & 0x80 ? dRaw - 0x100 : dRaw;
														const addr = (regValue + d) & 0xffff;
														this.#writeMemory(addr, this.#regs8bit[secondInsnLower]);
														setInsnInfo(3, 2, 19);
													}
													break;
												case 2: // ADD/ADC/SUB/SBC/AND/OR/XOR/CP A, (IX/IY+d)
													break;
												case 3:
													switch (secondInsn) {
														case 0xcb: // RLC/RL/RRC/RR/SLA/SRA/SRL (IX/IY+d) / BIT/SET/RES b, (IX+d)
															break;
														case 0xe1: // POP IX/IY
															break;
														case 0xe3: // EX (SP), IX/IY
															break;
														case 0xe5: // PUSH IX/IY
															break;
														case 0xe9: // JP (IX/IY)
															break;
														case 0xf9: // LD SP, IX/IY
															break;
													}
													break;
											}
											if (firstInsnMiddle === 7) {
												this.IY = regValue;
											} else {
												this.IX = regValue;
											}
										}
										break;
									case 5: // 0xED
										{
											const secondInsn = fetchInst(1);
											const secondInsnUpper = secondInsn >> 6;
											const secondInsnMiddle = (secondInsn >> 3) & 7;
											const secondInsnLower = secondInsn & 7;
											switch (secondInsnUpper) {
												case 1:
													switch (secondInsnLower) {
														case 0: // IN r, (C)
															{
																const dst = secondInsnMiddle;
																const value = this.#readIO(this.BC);
																this.F = (this.F & 0x29) |
																	(value & 0x80) |
																	(value === 0 ? 0x40 : 0) |
																	(R80C26.#isEvenParity8bit(value) ? 0x04 : 0);
																if (dst !== 6) this.#regs8bit[dst] = value;
																setInsnInfo(2, 2, 12);
															}
															break;
														case 1: // OUT (C), r
															if (secondInsnMiddle !== 6) {
																this.#writeIO(this.BC, this.#regs8bit[secondInsnMiddle]);
																setInsnInfo(2, 2, 12);
															}
															break;
														case 2: // SBC/ADC HL, ss
															{
																const src = secondInsnMiddle & 6;
																const srcValue = src === 6 ? this.SP : this.#regs8bitView.getUint16(src, false);
																const value = this.HL;
																const carry = this.F & 1;
																if (secondInsnMiddle & 1) { // ADC HL, ss
																	const result = value + srcValue + carry;
																	const resultH = (value & 0xfff) + (srcValue & 0xfff) + carry;
																	const overflow = (value & 0x8000) === (srcValue & 0x8000) && (value & 0x8000 !== result & 0x8000);
																	this.HL = result;
																	this.F = (this.F & 0x28) |
																		(result & 0x8000 ? 0x80 : 0) |
																		(this.HL === 0 ? 0x40 : 0) |
																		(resultH & 0x1000 ? 0x10 : 0) |
																		(overflow ? 0x04 : 0) |
																		(result & 0x10000 ? 0x01 : 0);
																} else { // SBC HL, ss
																	const srcValueInv = srcValue ^ 0xffff, carryInv = carry ^ 1;
																	const result = value + srcValueInv + carryInv;
																	const resultH = (value & 0xfff) + (srcValueInv & 0xfff) + carryInv;
																	const overflow = (value & 0x8000) === (srcValueInv & 0x8000) && (value & 0x8000 !== result & 0x8000);
																	this.HL = result;
																	this.F = (this.F & 0x28) |
																		(result & 0x8000 ? 0x80 : 0) |
																		(this.HL === 0 ? 0x40 : 0) |
																		(resultH & 0x1000 ? 0 : 0x10) |
																		(overflow ? 0x04 : 0) |
																		0x02 |
																		(result & 0x10000 ? 0 : 0x01);
																}
																setInsnInfo(2, 2, 15);
															}
															break;
														case 3: // LD (nn), dd / LD dd, (nn)
															{
																const addrLower = fetchInst(2);
																const addrUpper = fetchInst(3);
																const addr = addrLower | (addrUpper << 8);
																const target = secondInsnMiddle & 6;
																if (secondInsnMiddle & 1) { // LD dd, (nn)
																	const valueLower = this.#readMemory(addr);
																	const valueUpper = this.#readMemory((addr + 1) & 0xffff);
																	const value = valueLower | (valueUpper << 8);
																	if (target === 6) {
																		this.SP = value;
																	} else {
																		this.#regs8bitView.setUint16(target, value, false);
																	}
																} else { // LD (nn), dd
																	const value = target === 6 ? this.SP : this.#regs8bitView.getUint16(target, false);
																	this.#writeMemory(addr, value & 0xff);
																	this.#writeMemory((addr + 1) & 0xffff, value >> 8);
																}
																setInsnInfo(4, 2, 20);
															}
															break;
														case 4:
															if (secondInsnMiddle === 0) { // NEG
																const value = this.A;
																const result = (-value) & 0xff;
																const borrowCheck4 = (~value & 0xf) + 1;
																this.A = result;
																this.F = (this.F & 0x28) |
																	(result & 0x80) |
																	(result === 0 ? 0x40 : 0) |
																	(borrowCheck4 & 0x10 ? 0 : 0x10) |
																	(value === 0x80 ? 0x04 : 0) |
																	0x02 |
																	(value !== 0x00 ? 0x01 : 0);
																setInsnInfo(2, 2, 8);
															}
															break;
														case 5:
															if (secondInsnMiddle === 0 || secondInsnMiddle === 1) { // RETN / RETI
																const newPcLow = this.#readMemory(this.SP);
																const newPcHigh = this.#readMemory((this.SP + 1) & 0xffff);
																this.SP += 2;
																if (secondInsnMiddle === 0) { // RETN
																	this.IFF1 = this.IFF2;
																}
																setInsnInfo(2, 2, 14);
																nextPC = newPcLow | (newPcHigh << 8);
															}
															break;
														case 6: // IM 0 / IM 1 / IM 2
															{
																let newIMF = null;
																switch (secondInsnMiddle) {
																	case 0: newIMF = 0; break; // IM 0
																	case 2: newIMF = 1; break; // IM 1
																	case 3: newIMF = 2; break; // IM 2
																}
																if (newIMF !== null) {
																	this.IMF = newIMF;
																	setInsnInfo(2, 2, 8);
																}
															}
															break;
														case 7:
															switch (secondInsnMiddle) {
																case 0: // LD I, A
																	this.I = this.A;
																	setInsnInfo(2, 2, 9);
																	break;
																case 1: // LD R, A
																	this.R = this.A;
																	setInsnInfo(2, 0, 9);
																	break;
																case 2: // LD A, I
																	{
																		const value = this.I;
																		this.A = value;
																		this.F = (this.F & 0x29) |
																			(value & 0x80) |
																			(value === 0 ? 0x40 : 0) |
																			(this.IFF2 ? 0x04 : 0);
																		setInsnInfo(2, 2, 9);
																	}
																	break;
																case 3: // LD A, R
																	{
																		const value = (this.R & 0x80) | ((this.R + 2) & 0x7f);
																		this.A = value;
																		this.F = (this.F & 0x29) |
																			(value & 0x80) |
																			(value === 0 ? 0x40 : 0) |
																			(this.IFF2 ? 0x04 : 0);
																		setInsnInfo(2, 2, 9);
																	}
																	break;
																case 4: // RRD
																	{
																		const inA = this.A;
																		const inM = this.#readMemory(this.HL);
																		const outA = (inA & 0xf0) | (inM & 0x0f);
																		const outM = ((inA << 4) | (inM >> 4)) & 0xff;
																		this.A = outA;
																		this.#writeMemory(this.HL, outM);
																		this.F = (this.F & 0x29) |
																			(outA & 0x80) |
																			(outA === 0 ? 0x40 : 0) |
																			(R80C26.#isEvenParity8bit(outA) ? 0x04 : 0);
																		setInsnInfo(2, 2, 18);
																	}
																	break;
																case 5: // RLD
																	{
																		const inA = this.A;
																		const inM = this.#readMemory(this.HL);
																		const outA = (inA & 0xf0) | (inM >> 4);
																		const outM = ((inM << 4) | (inA & 0x0f)) & 0xff;
																		this.A = outA;
																		this.#writeMemory(this.HL, outM);
																		this.F = (this.F & 0x29) |
																			(outA & 0x80) |
																			(outA === 0 ? 0x40 : 0) |
																			(R80C26.#isEvenParity8bit(outA) ? 0x04 : 0);
																		setInsnInfo(2, 2, 18);
																	}
																	break;
															}
															break;
													}
													break;
												case 2:
													if ((secondInsnMiddle & 4) && !(secondInsnLower & 4)) {
														const operation = secondInsnLower & 3;
														const isIO = secondInsnLower & 2;
														const isBackward = secondInsnMiddle & 1;
														const isRepeat = secondInsnMiddle & 2;
														let compareMatched = false;
														switch (operation) {
															case 0: // LDI/LDIR/LDD/LDDR
																this.#writeMemory(this.DE, this.#readMemory(this.HL));
																if (isBackward) this.DE--; else this.DE++;
																this.F = (this.F & 0xe9) |
																	(this.BC === 1 ? 0 : 0x04);
																break;
															case 1: // CPI/CPD/CPIR/CPDR
																{
																	const A = this.A;
																	const value = this.#readMemory(this.HL);
																	const valueInv = value ^ 0xff;
																	const result = A + valueInv + 1;
																	const resultHalf = (A & 0xf) + (valueInv & 0xf) + 1;
																	compareMatched = A === value;
																	this.F = (this.F & 0x29) |
																		(result & 0x80) |
																		(compareMatched ? 0x40 : 0) |
																		(resultHalf & 0x10 ? 0 : 0x10) |
																		(this.BC === 1 ? 0 : 0x04) |
																		0x02;
																}
																break;
															case 2: // INI/INIR/INIR/INDR
																this.#writeMemory(this.HL, this.#readIO(this.BC));
																this.F = (this.F & 0xbd) |
																	(this.B === 1 ? 0x40 : 0) |
																	0x02;
																break;
															case 3: // OUTI/OUTD/OTIR/OTDR
																{
																	const newB = (this.B - 1) & 0xff;
																	this.#writeIO((newB << 8) | this.C, this.#readMemory(this.HL));
																	this.F = (this.F & 0xbd) |
																		(this.B === 1 ? 0x40 : 0) |
																		0x02;
																}
																break;
														}
														if (isBackward) this.HL--; else this.HL++;
														if ((isIO ? --this.B : --this.BC) !== 0 && isRepeat && !compareMatched) {
															setInsnInfo(0, 2, 21);
														} else {
															setInsnInfo(2, 2, 16);
														}
													}
													break;
											}
										}
										break;
								}
							}
							break;
						case 6: // ADD/ADC/SUB/SBC/AND/OR/XOR/CP A, n
							{
								const value = fetchInst(1);
								this.#arith8bit(value, firstInsnMiddle);
								setInsnInfo(2, 1, 7);
							}
							break;
						case 7: // RST p
							{
								const pcToSave = (currentPC + 1) & 0xffff;
								this.SP -= 2;
								this.#writeMemory((this.SP + 1) & 0xffff, pcToSave >> 8);
								this.#writeMemory(this.SP, pcToSave & 0xff);
								setInsnInfo(0, 1, 11);
								nextPC = firstInsnMiddle * 8;
							}
							break;
					}
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
		if (!preventSampleInterrupt) {
			// TODO: 割り込み (~INTピン) チェック
		}
		return deltaClock;
	}
}
