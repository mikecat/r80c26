"use strict";

class UART {
	// 状態
	#txBuffer = []; // コンピュータから外部へ送信 (以下、「送信」) するデータ用のFIFO
	#rxBuffer = []; // 外部からコンピュータへ受信 (以下、「受信」) するデータ用のFIFO
	#txRegister = null; // 現在送信中のデータ
	#rxRegister = null; // 現在受信中のデータ
	#txTimeLeft = 0; // 送信にかかる残り時間 (秒)
	#rxTimeLeft = 0; // 受信にかかる残り時間 (秒)
	#rxDelayTimeLeft = 0; // 次の受信までの残り時間 (秒)
	#dataToReceive = []; // この後受信するデータ
	#dataSent = []; // 送信したデータ
	#rxOverflow = false; // 受信するデータ用のFIFOがいっぱいのときにデータを受信したか

	// 設定
	#txBufferCapacity = 1; // 送信するデータ用のFIFOの容量 (要素数)
	#rxBufferCapacity = 2; // 受信するデータ用のFIFOの容量 (要素数)
	#baudRate = 9600; // 通信速度 (bps)
	#timePerChar = 10 / 9600; // 1文字の送受信にかかる時間 (秒)
	#rxCharDelay = 0; // 受信時1文字ごとに空ける間隔 (秒)
	#rxLineDelay = 0; // 受信時1行ごとに空ける間隔 (秒)
	#localEcho = false; // 受信した文字を送信したデータに追加するか

	set txBufferCapacity(value) {
		if (!isNaN(value)) this.#txBufferCapacity = Math.max(1, Math.floor(value));
	}
	get txBufferCapacity() { return this. #txBufferCapacity; }

	set rxBufferCapacity(value) {
		if (!isNaN(value)) this.#rxBufferCapacity = Math.max(1, Math.floor(value));
	}
	get rxBufferCapacity() { return this. #rxBufferCapacity; }

	set baudRate(value) {
		if (!isNaN(value)) {
			this.#baudRate = Math.max(0, value);
			// 1文字はスタート(1ビット)+8ビット+ストップ(1ビット)の10ビット
			// 1文字あたりの時間 = 1ビットあたりの時間 * 10 = (1 / 1秒あたりのビット数) * 10
			this.#timePerChar = this.#baudRate === 0 ? Infinity : 10 / this.#baudRate;
		}
	}
	get baudRate() { return this.#baudRate; }

	set rxCharDelay(value) {
		if (!isNaN(value)) this.#rxCharDelay = Math.max(0, value);
	}
	get rxCharDelay() { return this.#rxCharDelay; }

	set rxLineDelay(value) {
		if (!isNaN(value)) this.#rxLineDelay = Math.max(0, value);
	}
	get rxLineDelay() { return this.#rxLineDelay; }

	set localEcho(value) {
		this.#localEcho = !!value;
	}
	get localEcho() { return this.#localEcho; }

	// UARTの状態をリセットする
	reset() {
		this.#txBuffer = [];
		this.#rxBuffer = [];
		this.#txRegister = null;
		this.#rxRegister = null;
		this.#txTimeLeft = 0;
		this.#rxTimeLeft = 0;
		this.#rxDelayTimeLeft = 0;
		this.#dataToReceive = [];
		this.#dataSent = [];
		this.#rxOverflow = false;
	}

	// 時間を指定した秒数進める
	progressTime(deltaSeconds) {
		while (deltaSeconds > 0) {
			// 処理中の要素のうち、残り時間が最小のものに合わせる
			let delta = deltaSeconds;
			if (this.#txRegister !== null && this.#txTimeLeft < delta) delta = this.#txTimeLeft;
			if (this.#rxRegister !== null && this.#rxTimeLeft < delta) delta = this.#rxTimeLeft;
			if (this.#rxDelayTimeLeft > 0 && this.#rxDelayTimeLeft < delta) delta = this.#rxDelayTimeLeft;
			if (delta <= 0) delta = 0;
			deltaSeconds -= delta;
			// 送信処理
			if (this.#txRegister !== null) {
				this.#txTimeLeft -= delta;
				// 1文字の送信が完了する時間になったら
				if (this.#txTimeLeft <= 0) {
					// 送信した文字を追加する
					this.#dataSent.push(this.#txRegister);
					if (this.#txBuffer.length > 0) {
						// 送信する文字があるなら、その送信を開始する
						this.#txRegister = this.#txBuffer.shift();
						this.#txTimeLeft = this.#timePerChar;
					} else {
						// 送信する文字が無いなら、送信を終了する
						this.#txRegister = null;
						this.#txTimeLeft = 0;
					}
				}
			}
			// 受信処理
			// 仮仕様：待ち時間は受信時間を含まない、行待ちは文字待ちと別に追加する
			this.#rxDelayTimeLeft -= delta;
			if (this.#rxRegister !== null) {
				this.#rxTimeLeft -= delta;
				// 1文字の受信が完了する時間になったら
				if (this.#rxTimeLeft <= 0) {
					// バッファに空きがあれば、受信した文字を追加する
					if (this.#rxBuffer.length < this.#rxBufferCapacity) {
						this.#rxBuffer.push(this.#rxRegister);
					} else {
						this.#rxOverflow = true;
					}
					// 次の文字があり、かつ受信待ちでなければ、次の文字の受信を開始する
					if (this.#dataToReceive.length > 0 && this.#rxDelayTimeLeft <= 0) {
						const data = this.#dataToReceive.shift();
						this.#rxRegister = data;
						this.#rxTimeLeft = this.#timePerChar;
						this.#rxDelayTimeLeft = this.#rxCharDelay;
						if (data === 0x0d || data === 0x0a) this.#rxDelayTimeLeft += this.#rxLineDelay;
						if (this.#localEcho) this.#dataSent.push(data);
					} else {
						// 次の文字が無いか受信待ち中なので、受信を終了する
						this.#rxRegister = null;
						this.#rxTimeLeft = 0;
					}
				}
				// 受信中に待ちが完了したので、待ち時間をゼロにする
				if (this.#rxDelayTimeLeft <= 0) this.#rxDelayTimeLeft = 0;
			} else if (this.#rxDelayTimeLeft <= 0) {
				// 受信中でなく、受信待ちが完了した
				if (this.#dataToReceive.length > 0) {
					// 次に受信する文字があれば、受信を開始する
					const data = this.#dataToReceive.shift();
					this.#rxRegister = data;
					this.#rxTimeLeft = this.#timePerChar;
					this.#rxDelayTimeLeft = this.#rxCharDelay;
					if (data === 0x0d || data === 0x0a) this.#rxDelayTimeLeft += this.#rxLineDelay;
						if (this.#localEcho) this.#dataSent.push(data);
				} else {
					// 次に受信する文字が無いので、受信を終了する
					this.#rxDelayTimeLeft = 0;
				}
			}
		}
	}

	// データを受信する (反復可能オブジェクトを指定する)
	addReceivedData(dataArray) {
		const data = new Uint8Array(Array.from(dataArray));
		data.forEach((d) => this.#dataToReceive.push(d));
	}

	// 送信されたデータを取得する (内部から取り除く)
	getDataSent() {
		const data = this.#dataSent;
		this.#dataSent = [];
		return data;
	}

	// データレジスタを読む (受信したデータがあれば返す)
	readDataRegister() {
		if (this.#rxBuffer.length > 0) {
			return this.#rxBuffer.shift();
		}
		return 0;
	}

	// データレジスタに書き込む (送信するデータ用のFIFOに空きがあれば入れる)
	writeDataRegister(value) {
		if (this.#txBuffer.length < this.#txBufferCapacity) {
			this.#txBuffer.push(value & 0xff);
		}
	}

	// 状態を返す
	getStatus() {
		return {
			txBufferHasSpace: this.#txBuffer.length < this.#txBufferCapacity,
			rxBufferHasData: this.#rxBuffer.length > 0,
			rxOverflow: this.#rxOverflow,
		};
	}
}
