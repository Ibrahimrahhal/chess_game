import Chess from './chess.js';
export default class Zobrist {

	constructor(low, high) {
		this.low = low >>> 0;
		this.high = high >>> 0;
	}

	static Count = {
		TURN: 1 * 2,
		PIECE_COLOR_SQUARE: 6 * 2 * 64 * 2,
		CASTLING_RIGHTS: 16 * 2,
		EN_PASSANT_FILE: 8 * 2
	}

	static Position = {
		TURN: 0,
		PIECE_COLOR_SQUARE: Zobrist.Count.TURN,
		CASTLING_RIGHTS: Zobrist.Count.TURN + Zobrist.Count.PIECE_COLOR_SQUARE,
		EN_PASSANT_FILE: Zobrist.Count.TURN + Zobrist.Count.PIECE_COLOR_SQUARE + Zobrist.Count.CASTLING_RIGHTS
	}

	static createRandomValues(count) {
		var a = [];
		for (var i = 0; i < count; ++i) {
			a.push((1 + Math.random() * 0xFFFFFFFF) >>> 0);
		}
		return a;
	}

	static RANDOM_VALUES = Zobrist.createRandomValues(Zobrist.Position.EN_PASSANT_FILE + Zobrist.Count.EN_PASSANT_FILE);
	
	dup() {
		return new Zobrist(this.low, this.high);
	}


	getHashKey() {
		return (this.low ^ this.high) >>> 0;
	}


	isEqual(zobrist) {
		return (this.low === zobrist.low && this.high === zobrist.high);
	}


	update(position) {
		this.low = (this.low ^ Zobrist.RANDOM_VALUES[position]) >>> 0;
		this.high = (this.high ^ Zobrist.RANDOM_VALUES[position + 1]) >>> 0;
		return this;
	}

	updateTurn() {
		return this.update(Zobrist.Position.TURN);
	}

	updatePieceColorSquare(piece, color, index) {
		return this.update(Zobrist.Position.PIECE_COLOR_SQUARE + piece + color * 6 + index * 6 * 2);
	}

	updatePieceColorBitboard(piece, color, bitboard) {
		var bb = bitboard.dup();
		while (!bb.isEmpty()) {
			this.updatePieceColorSquare(piece, color, bb.extractLowestBitPosition());
		}
		return this;
	}


	updateCastlingRights(castlingRights) {
		return this.update(Zobrist.Position.CASTLING_RIGHTS + castlingRights);
	}


	updateEnPassantFile(enPassantFile) {
		return this.update(Zobrist.Position.EN_PASSANT_FILE + enPassantFile);
	}

	updateEnPassantSquare(enPassantSquare) {
		if (enPassantSquare >= 0) {
			return this.updateEnPassantFile(Chess.getFile(enPassantSquare));
		}
		return this;
	}
}
