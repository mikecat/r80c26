R80C26
======

Z80エミュレータ。

[https://mikecat.github.io/r80c26/](https://mikecat.github.io/r80c26/)

## メモリマップ

[EMUZ80](https://vintagechips.wordpress.com/2022/03/05/emuz80_reference/) の仕様に合わせています。

* 0x0000～0x7fff：ROM
* 0x8000～最大0xdfff：RAM
* 0xe000：UART送受信データ
* 0xe001：UART状態

## UARTの使い方

画面上部の黒いテキスト入力欄に入力することで、UARTにテキストを送信できます。  
また、UARTで受信したデータがこの欄に表示されます。

### 端末設定

#### local echo

オンにすると、送信したデータも欄に表示します。

#### TX newline

改行として送信するデータを設定します。

#### TX delay

文字の送信間隔を設定します。

「/line」の値は、「/char」の値より大きい場合、改行を送信した後の間隔として「/char」の値のかわりに用います。

### レジスタ

#### 送受信 0xe000

このレジスタにCPUから値を書き込むと、端末にデータを送信 (端末が受信) できます。

このレジスタからCPUから値を読み込むと、端末から送信されたデータを受信できます。  
読み込んだデータはバッファから取り除かれます。

#### 状態 0xe001

UARTの状態を読み込めます。書き込みは無視されます。

状態は、以下の値のビットORです。

* 1：受信バッファにデータがある (レジスタ 0xe000 から有効な値を読み込むことができる)
* 2：送信バッファに空きがある (レジスタ 0xe000 に値を書き込むことで、送信できる)

## 参考資料

* [Z80 CPU User Manual - um0080.pdf](https://www.zilog.com/docs/z80/um0080.pdf)
* [Visual Z80 Remix](https://floooh.github.io/visualz80remix/)
