export default class Bitboard {
	constructor(low, high) {
		this.low = low >>> 0;
		this.high = high >>> 0;
	}

	static popcnt32(v) {
		v >>>= 0;
		v -= (v >>> 1) & 0x55555555;
		v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
		return ((v + (v >>> 4) & 0xF0F0F0F) * 0x1010101) >>> 24;
	}

	static popLowestBit32(v) {
		v >>>= 0;
		return (v & (v - 1)) >>> 0;
	}

	static getLowestBitPosition32(v) {
		v >>>= 0;
		return Bitboard.popcnt32((v & -v) - 1);
	}

	popcnt() {
		return Bitboard.popcnt32(this.low) + Bitboard.popcnt32(this.high);
	}

	popLowestBit() {
		if (this.low) {
			this.low = Bitboard.popLowestBit32(this.low);
		} else {
			this.high = Bitboard.popLowestBit32(this.high);
		}
	
		return this;
	}

	getLowestBitPosition() {
		if (this.low) {
			return Bitboard.getLowestBitPosition32(this.low);
		}
	
		return 32 + Bitboard.getLowestBitPosition32(this.high);
	}

	extractLowestBitPosition() {
		var index = this.getLowestBitPosition();
		this.popLowestBit();
		return index;
	}

	isEmpty() {
		return !this.low && !this.high;
	}

	isClear(index) {
		index >>>= 0;
	
		if (index < 32) {
			return !(this.low & (1 << index));
		}
	
		return !(this.high & (1 << (index - 32)));
	}

	isSet(index) {
		return !this.isClear(index);
	}

	setBit(index) {
		index >>>= 0;
	
		if (index < 32) {
			this.low = (this.low | (1 << index)) >>> 0;
		} else {
			this.high = (this.high | (1 << (index - 32))) >>> 0;
		}
	
		return this;
	}

	clearBit(index) {
		index >>>= 0;
	
		if (index < 32) {
			this.low = (this.low & ~(1 << index)) >>> 0;
		} else {
			this.high = (this.high & ~(1 << (index - 32))) >>> 0;
		}
	
		return this;
	}


	and(other) {
		this.low = (this.low & other.low) >>> 0;
		this.high = (this.high & other.high) >>> 0;
	
		return this;
	}

	and_not(other) {
		this.low = (this.low & ~other.low) >>> 0;
		this.high = (this.high & ~other.high) >>> 0;
	
		return this;
	}

	or(other) {
		this.low = (this.low | other.low) >>> 0;
		this.high = (this.high | other.high) >>> 0;
	
		return this;
	}

	xor(other) {
		this.low = (this.low ^ other.low) >>> 0;
		this.high = (this.high ^ other.high) >>> 0;
	
		return this;
	}

	not() {
		this.low = (~this.low) >>> 0;
		this.high = (~this.high) >>> 0;
	
		return this;
	}

	shl(v) {
		v >>>= 0;
	
		if (v > 31) {
			this.high = (this.low << (v - 32)) >>> 0;
			this.low = 0 >>> 0;
		} else if (v > 0) {
			this.high = ((this.high << v) | (this.low >>> (32 - v))) >>> 0;
			this.low = (this.low << v) >>> 0;
		}
	
		return this;
	}

	shr(v) {
		v >>>= 0;
	
		if (v > 31) {
			this.low = this.high >>> (v - 32);
			this.high = 0 >>> 0;
		} else if (v > 0) {
			this.low = ((this.low >>> v) | (this.high << (32 - v))) >>> 0;
			this.high >>>= v;
		}
	
		return this;
	}

	shiftLeft(v) {
		if (v > 63 || v < -63) {
			this.low = this.high = 0 >>> 0;
		} else if (v > 0) {
			this.shl(v);
		} else if (v < 0) {
			this.shr(-v);
		}
	
		return this;
	}

	isEqual(other) {
		return this.low === other.low && this.high === other.high;
	}

	dup() {
		return Bitboard.make(this.low, this.high);
	}

	static make(low, high) {
		return new Bitboard(low, high);
	}

	static makeZero() {
		return Bitboard.make(0, 0);
	}

	static makeOne() {
		return Bitboard.make(0xFFFFFFFF, 0xFFFFFFFF);
	}

	static makeLightSquares() {
		return Bitboard.make(0x55AA55AA, 0x55AA55AA);
	}

	static makeDarkSquares() {
		return Bitboard.make(0xAA55AA55, 0xAA55AA55);
	}
	
	static makeFile(file) {
		return Bitboard.make(0x01010101, 0x01010101).shl(file);
	}
	
	static makeFiles() {
		var b = [];
		for (var i = 0; i < 8; ++i) {
			b.push(Bitboard.makeFile(i));
		}
		return b;
	}

	static makeRank(rank) {
		return Bitboard.make(0xFF, 0).shl(rank * 8);
	}

	static makeRanks() {
		var b = [];
		for (var i = 0; i < 8; ++i) {
			b.push(Bitboard.makeRank(i));
		}
		return b;
	}

	static makeIndex(index) {
		return Bitboard.makeZero().setBit(index);
	}

	static makeIndices() {
		var b = [];
		for (var i = 0; i < 64; ++i) {
			b.push(Bitboard.makeIndex(i));
		}
		return b;
	}

	static makeDiagonal(diagonal) {
		return Bitboard.make(0x10204080, 0x01020408).and(Bitboard.makeOne().shiftLeft(diagonal * 8)).shiftLeft(diagonal);
	}

	static makeDiagonals() {
		var b = [];
		for (var i = -7; i < 8; ++i) {
			b.push(Bitboard.makeDiagonal(i));
		}
		return b;
	}

	static makeAntidiagonal(antidiagonal) {
		return Bitboard.make(0x08040201, 0x80402010).and(Bitboard.makeOne().shiftLeft(-antidiagonal * 8)).shiftLeft(antidiagonal);
	}

	static makeAntidiagonals() {
		var b = [];
		for (var i = -7; i < 8; ++i) {
			b.push(Bitboard.makeAntidiagonal(i));
		}
		return b;
	}

	static makeKnightMovement(index) {
		var b = Bitboard.makeZero().setBit(index);
		var l1 = b.dup().shr(1).and_not(Bitboard.FILES[7]);
		var l2 = b.dup().shr(2).and_not(Bitboard.FILES[7]).and_not(Bitboard.FILES[6]);
		var r1 = b.dup().shl(1).and_not(Bitboard.FILES[0]);
		var r2 = b.dup().shl(2).and_not(Bitboard.FILES[0]).and_not(Bitboard.FILES[1]);
		var v1 = l2.or(r2);
		var v2 = l1.or(r1);
		return v1.dup().shl(8).or(v1.shr(8)).or(v2.dup().shl(16)).or(v2.shr(16));
	}

	static makeKnightMovements() {
		var b = [];
		for (var i = 0; i < 64; ++i) {
			b.push(Bitboard.makeKnightMovement(i));
		}
		return b;
	};

	static makeKingMovement(index) {
		var b = Bitboard.makeZero().setBit(index);
		var c = b.dup().shr(1).and_not(Bitboard.FILES[7]).or(b.dup().shl(1).and_not(Bitboard.FILES[0]));
		var u = b.dup().or(c).shr(8);
		var d = b.dup().or(c).shl(8);
		return c.or(u).or(d);
	}

	static makeKingMovements() {
		var b = [];
		for (var i = 0; i < 64; ++i) {
			b.push(Bitboard.makeKingMovement(i));
		}
		return b;
	}

	static ZERO = this.makeZero();
	static ONE = this.makeOne();
	static LIGHT_SQUARES = this.makeLightSquares();
	static DARK_SQUARES = this.makeDarkSquares();
	static FILES = this.makeFiles();
	static RANKS = this.makeRanks();
	static DIAGONALS = this.makeDiagonals();
	static ANTIDIAGONALS = this.makeAntidiagonals();
	static KNIGHT_MOVEMENTS = this.makeKnightMovements();
	static KING_MOVEMENTS = this.makeKingMovements();
}


