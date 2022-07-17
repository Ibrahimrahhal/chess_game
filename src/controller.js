import Chess from './chess.js';

export default class Controller {

	static Kind = {
		POSITIONAL: 0,
		DOUBLE_PAWN_PUSH: 1,
		KING_CASTLE: 2, // kingside castle
		QUEEN_CASTLE: 3, // queenside castle
		CAPTURE: 4,
		EN_PASSANT_CAPTURE: 5,
		KNIGHT_PROMOTION: 8,
		BISHOP_PROMOTION: 9,
		ROOK_PROMOTION: 10,
		QUEEN_PROMOTION: 11,
		KNIGHT_PROMOTION_CAPTURE: 12,
		BISHOP_PROMOTION_CAPTURE: 13,
		ROOK_PROMOTION_CAPTURE: 14,
		QUEEN_PROMOTION_CAPTURE: 15
	}
	Kind = Controller.Kind;
	constructor(from, to, kind, piece, capturedPiece) {
		this.value = (to & 0x3F) | ((from & 0x3F) << 6) | ((kind & 0xF) << 12) | ((piece & 0x7) << 16) | (((capturedPiece | 0) & 0x7) << 19);
	}

	getTo() {
		return this.value & 0x3F;
	}

	getFrom() {
		return (this.value >>> 6) & 0x3F;
	}

	getKind() {
		return (this.value >>> 12) & 0xF;
	}

	getPiece() {
		return (this.value >>> 16) & 0x7;
	}

	isCapture() {
		return Boolean(this.getKind() & 4);
	}

	getCapturedPiece() {
		return (this.value >>> 19) & 0x7;
	}

	isPromotion () {
		return Boolean(this.getKind() & 8);
	}

	isCastle() {
		return this.getKind() === this.Kind.KING_CASTLE || this.getKind() === this.Kind.QUEEN_CASTLE;
	}

	getPromotedPiece() {
		if (this.isPromotion()) {
			return (Chess.Piece.KNIGHT + (this.getKind() & 3));
		}
	
		return Chess.Piece.PAWN;
	}

	getCaptureSquare = function() {
		if (this.getKind() !== this.Kind.EN_PASSANT_CAPTURE) {
			return this.getTo();
		}
	
		return this.getTo() + ((this.getFrom() < this.getTo()) ? -Chess.FILES : Chess.FILES);
	}

	getString() {
		if (!this.isCastle()) {
			return Chess.PIECE_ALGEBRAIC_NAMES.charAt(this.getPiece()) +
				Chess.getAlgebraicFromIndex(this.getFrom()) +
				(this.isCapture() ? "x" : "-") +
				Chess.getAlgebraicFromIndex(this.getTo()) +
				((this.getKind() === this.Kind.EN_PASSANT_CAPTURE) ? "e.p." : "") +
				(this.isPromotion() ? Chess.PIECE_ALGEBRAIC_NAMES.charAt(this.getPromotedPiece()) : "");
		}
	
		return "0-0" + ((this.getKind() === this.Kind.QUEEN_CASTLE) ? "-0" : "");
	}
}

