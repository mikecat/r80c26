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
	}

	// 1命令実行し、かかったクロック数を返す
	step() {
		this.PC++;
		return 4;
	}
}
