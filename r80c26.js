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
			case 5: // OR
			case 6: // XOR
				{
					const res =
						kind === 4 ? this.A & value :
						kind === 5 ? this.A | value :
						this.A ^ value;
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
									this.HF = value;
								} else {
									this.#regs8bitView.setUint16(0, value, false);
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
