import Zobrist from './zobrist.js';
import Chess from './chess.js';
import Bitboard from './bitboard.js';
import Controller from './controller.js';

export default class Position {
	static ANY_WHITE = Chess.Piece.KING + 1;
	static ANY_BLACK = Position.ANY_WHITE + 1;
	static ROOK_INDICES = [7, 63, 0, 56];
	static SLIDING_MASKS = [Bitboard.makeFile(Chess.LAST_FILE).not(), Bitboard.ONE, Bitboard.makeFile(0).not()];
	static Status = {
		NORMAL: 0,
		CHECKMATE: 1,
		STALEMATE_DRAW: 2,
		FIFTY_MOVE_RULE_DRAW: 3,
		THREEFOLD_REPETITION_RULE_DRAW: 4,
		INSUFFICIENT_MATERIAL_DRAW: 5
	}
	static perft(depth, chessPosition) {
		if (!depth) {
			return 1;
		}
	
		if (!chessPosition) {
			chessPosition = new Position;
		}
		var nodes = 0;
		chessPosition.getMoves(true).forEach(function(move) {
			if (chessPosition.makeMove(move)) {
				nodes += Position.perft(depth - 1, chessPosition);
				chessPosition.unmakeMove();
			}
		});
	
		return nodes;
	}
	constructor() {
		this.hashKey = new Zobrist(0, 0);
		this.bitboards = [
			Bitboard.RANKS[1].dup().or(Bitboard.RANKS[6]), // pawns
			Bitboard.makeIndex(1).or(Bitboard.makeIndex(6)).or(Bitboard.makeIndex(57)).or(Bitboard.makeIndex(62)), // knights
			Bitboard.makeIndex(2).or(Bitboard.makeIndex(5)).or(Bitboard.makeIndex(58)).or(Bitboard.makeIndex(61)), // bishops
			Bitboard.makeIndex(0).or(Bitboard.makeIndex(7)).or(Bitboard.makeIndex(56)).or(Bitboard.makeIndex(63)), // rooks
			Bitboard.makeIndex(3).or(Bitboard.makeIndex(59)), // queens
			Bitboard.makeIndex(4).or(Bitboard.makeIndex(60)), // kings
			Bitboard.RANKS[0].dup().or(Bitboard.RANKS[1]), // white pieces
			Bitboard.RANKS[6].dup().or(Bitboard.RANKS[7]) // black pieces
		];

		this.pieces = [];
		this.turn = Chess.PieceColor.WHITE;
		this.castlingRights = 15;
		this.enPassantSquare = -1;
		this.halfmoveClock = 0;
		this.madeMoves = [];
		this.irreversibleHistory = [];
		this.fillPiecesFromBitboards();
		this.hashHistory = [];
	}


	getMoves(pseudoLegal, onlyCaptures) {
		var moves = this.generateMoves(!!onlyCaptures);
		return pseudoLegal ? moves : moves.filter(Position.prototype.isMoveLegal, this);
	}

	getColorBitboard(color) {
		return this.bitboards[Position.ANY_WHITE + color];
	}

	getPieceBitboard(piece) {
		return this.bitboards[piece];
	}

	getPieceColorBitboard(piece, color) {
		return this.bitboards[piece].dup().and(this.getColorBitboard(color));
	}

	getKingPosition(color) {
		return this.getPieceColorBitboard(Chess.Piece.KING, color).getLowestBitPosition();
	}

	getOccupiedBitboard() {
		return this.bitboards[Position.ANY_WHITE].dup().or(this.bitboards[Position.ANY_BLACK]);
	}

	getEmptyBitboard() {
		return this.getOccupiedBitboard().not();
	}

	getTurnColor() {
		return this.turn;
	}

	findPieceAtOrNull(index) {
		for (var piece = Chess.Piece.PAWN; piece <= Chess.Piece.KING; ++piece) {
			if (this.getPieceBitboard(piece).isSet(index)) {
				return piece;
			}
		}
	
		return null;
	}

	getPieceAtOrNull(index) {
		return this.pieces[index];
	}

	fillPiecesFromBitboards() {
		this.pieces.length = 0;
		for (var index = 0; index < 64; ++index) {
			this.pieces.push(this.findPieceAtOrNull(index));
		}
	}

	updateHashKey() {
		this.hashKey = new Zobrist(0, 0);
	
		if (this.getTurnColor()) {
			this.hashKey.updateTurn();
		}
	
		for (var color = Chess.PieceColor.WHITE; color <= Chess.PieceColor.BLACK; ++color) {
			for (var piece = Chess.Piece.PAWN; piece <= Chess.Piece.KING; ++piece) {
				this.hashKey.updatePieceColorBitboard(piece, color, this.getPieceColorBitboard(piece, color));
			}
		}
	
		this.hashKey.updateCastlingRights(this.castlingRights);
		this.hashKey.updateEnPassantSquare(this.enPassantSquare);
	}

	isKingInCheck() {
		return this.isAttacked(Chess.getOtherPieceColor(this.getTurnColor()), this.getKingPosition(this.getTurnColor()));
	}

	static makePawnAttackMask(color, pawns) {
		var white = (color === Chess.PieceColor.WHITE);
		var attacks1 = pawns.dup().and_not(Bitboard.FILES[0]).shiftLeft(white ? 7 : -9);
		var attacks2 = pawns.dup().and_not(Bitboard.FILES[Chess.LAST_FILE]).shiftLeft(white ? 9 : -7);
		return attacks1.or(attacks2);
	}

	static makeSlidingAttackMask(fromBB, occupied, rankDirection, fileDirection) {
		var bb = Bitboard.makeZero();
		var direction = rankDirection * Chess.FILES + fileDirection;
		var mask = Position.SLIDING_MASKS[1 + fileDirection];
	
		for (fromBB.shiftLeft(direction); !fromBB.and(mask).isEmpty(); fromBB.and_not(occupied).shiftLeft(direction)) {
			bb.or(fromBB);
		}
	
		return bb;
	}

	static makeBishopAttackMask(fromBB, occupied) {
		return Position.makeSlidingAttackMask(fromBB.dup(), occupied, 1, 1).or(
			Position.makeSlidingAttackMask(fromBB.dup(), occupied, 1, -1)).or(
			Position.makeSlidingAttackMask(fromBB.dup(), occupied, -1, 1)).or(
			Position.makeSlidingAttackMask(fromBB.dup(), occupied, -1, -1));
	}

	static makeRookAttackMask(fromBB, occupied) {
		return Position.makeSlidingAttackMask(fromBB.dup(), occupied, 0, 1).or(
			Position.makeSlidingAttackMask(fromBB.dup(), occupied, 0, -1)).or(
			Position.makeSlidingAttackMask(fromBB.dup(), occupied, 1, 0)).or(
			Position.makeSlidingAttackMask(fromBB.dup(), occupied, -1, 0));
	}

	static getCastlingIndex(color, kingSide) {
		return color + (kingSide ? 0 : 2);
	}
	
	static getCastlingRookSquare(color, kingSide) {
		return Position.ROOK_INDICES[Position.getCastlingIndex(color, kingSide)];
	}

	isAttacked(color, index) {
		var pawns = this.getPieceColorBitboard(Chess.Piece.PAWN, color);
		if (Position.makePawnAttackMask(color, pawns).isSet(index)) {
			return true;
		}
	
		var knights = this.getPieceColorBitboard(Chess.Piece.KNIGHT, color);
		if (!Bitboard.KNIGHT_MOVEMENTS[index].dup().and(knights).isEmpty()) {
			return true;
		}
	
		var king = this.getPieceColorBitboard(Chess.Piece.KING, color);
		if (!Bitboard.KING_MOVEMENTS[index].dup().and(king).isEmpty()) {
			return true;
		}
	
		var occupied = this.getOccupiedBitboard();
		var queens = this.getPieceColorBitboard(Chess.Piece.QUEEN, color);
	
		var bq = this.getPieceColorBitboard(Chess.Piece.BISHOP, color).dup().or(queens);
		if (Position.makeBishopAttackMask(bq, occupied).isSet(index)) {
			return true;
		}
	
		var rq = this.getPieceColorBitboard(Chess.Piece.ROOK, color).dup().or(queens);
		if (Position.makeRookAttackMask(rq, occupied).isSet(index)) {
			return true;
		}
	
		return false;
	}


	hasCastlingRight(color, kingSide) {
		return 0 !== (this.castlingRights & (1 << Position.getCastlingIndex(color, kingSide)));
	}

	clearCastlingRight(color, kingSide) {
		this.hashKey.updateCastlingRights(this.castlingRights);
		this.castlingRights &= ~(1 << Position.getCastlingIndex(color, kingSide));
		this.hashKey.updateCastlingRights(this.castlingRights);
	}

	canCastle(color, kingSide, onlyLegal) {
		if (!this.hasCastlingRight(color, kingSide)) {
			return false;
		}
	
		var direction = kingSide ? 1 : -1;
		var kingPosition = (color === Chess.PieceColor.WHITE) ? 4 : 60;
		var occupied = this.getOccupiedBitboard();
	
		if (occupied.isSet(kingPosition + direction) || occupied.isSet(kingPosition + 2 * direction)) {
			return false;
		}
	
		if (!kingSide && occupied.isSet(kingPosition + 3 * direction)) {
			return false;
		}
	
		if (onlyLegal && !this.isCastlingLegal(color, kingSide)) {
			return false;
		}
	
		return true;
	}

	isCastlingLegal(color, kingSide) {
		var otherColor = Chess.getOtherPieceColor(color);
		var direction = kingSide ? 1 : -1;
		var kingPosition = (color === Chess.PieceColor.WHITE) ? 4 : 60;
	
		return !this.isAttacked(otherColor, kingPosition) && !this.isAttacked(otherColor, kingPosition + direction) && !this.isAttacked(otherColor, kingPosition + 2 * direction);
	}

	canEnPassant() {
		return this.getEnPassantSquare() >= 0;
	}

	getEnPassantSquare() {
		return this.enPassantSquare;
	}

	isFiftyMoveRuleDraw() {
		return this.halfmoveClock >= 100;
	}

	isThreefoldRepetitionRuleDraw() {
		var currentHashKey = this.hashKey;
		return this.hashHistory.reduce(
			function(previousValue, currentValue, index, array) { return previousValue + (currentValue.isEqual(currentHashKey) ? 1 : 0); }, 0) >= 3;
	}

	isInsufficientMaterialDraw() {
		if (!this.getPieceBitboard(Chess.Piece.PAWN).isEmpty()) {
			return false;
		}
	
		if (!this.getPieceBitboard(Chess.Piece.ROOK).isEmpty()) {
			return false;
		}
	
		if (!this.getPieceBitboard(Chess.Piece.QUEEN).isEmpty()) {
			return false;
		}
	
		// only kings, knights and bishops on the board
		var whiteCount = this.getColorBitboard(Chess.PieceColor.WHITE).popcnt();
		var blackCount = this.getColorBitboard(Chess.PieceColor.BLACK).popcnt();
	
		if (whiteCount + blackCount < 4) {
			// king vs king, king&bishop vs king, king&knight vs king
			return true;
		}
	
		if (!this.getPieceBitboard(Chess.Piece.KNIGHT).isEmpty()) {
			return false;
		}
	
		// only kings and bishops on the board
		var bishops = this.getPieceBitboard(Chess.Piece.BISHOP);
		if (bishops.dup().and(Bitboard.LIGHT_SQUARES).isEqual(bishops) || bishops.dup().and(Bitboard.DARK_SQUARES).isEqual(bishops)) {
			return true;
		}
	
		return false;
	}

	isDraw() {
		return this.isFiftyMoveRuleDraw() || this.isThreefoldRepetitionRuleDraw() || this.isInsufficientMaterialDraw();
	};

	getStatus() {
		if (!this.getMoves().length) {
			return this.isKingInCheck() ? Position.Status.CHECKMATE : Position.Status.STALEMATE_DRAW;
		}
	
		if (this.isFiftyMoveRuleDraw()) {
			return Position.Status.FIFTY_MOVE_RULE_DRAW;
		}
	
		if (this.isThreefoldRepetitionRuleDraw()) {
			return Position.Status.THREEFOLD_REPETITION_RULE_DRAW;
		}
	
		if (this.isInsufficientMaterialDraw()) {
			return Position.Status.INSUFFICIENT_MATERIAL_DRAW;
		}
	
		return Position.Status.NORMAL;
	}

	generateMoves(onlyCaptures) {
		var moves = [];
	
		var turnColor = this.getTurnColor();
		var opponentBB = this.getColorBitboard(Chess.getOtherPieceColor(turnColor));
		var occupied = this.getOccupiedBitboard();
		var chessPosition = this;
	
		function addPawnMoves(toMask, movement, kind) {
			while (!toMask.isEmpty()) {
				var index = toMask.extractLowestBitPosition();
				moves.push(new Controller(index - movement, index, kind, Chess.Piece.PAWN, chessPosition.getPieceAtOrNull(index)));
			}
		}
		function addPawnPromotions(toMask, movement, capture) {
			addPawnMoves(toMask.dup(), movement, capture ? Controller.Kind.QUEEN_PROMOTION_CAPTURE : Controller.Kind.QUEEN_PROMOTION);
			addPawnMoves(toMask.dup(), movement, capture ? Controller.Kind.ROOK_PROMOTION_CAPTURE : Controller.Kind.ROOK_PROMOTION);
			addPawnMoves(toMask.dup(), movement, capture ? Controller.Kind.BISHOP_PROMOTION_CAPTURE : Controller.Kind.BISHOP_PROMOTION);
			addPawnMoves(toMask.dup(), movement, capture ? Controller.Kind.KNIGHT_PROMOTION_CAPTURE : Controller.Kind.KNIGHT_PROMOTION);
		}
	
		var fileDirection = 1 - 2 * turnColor;
		var rankDirection = Chess.FILES * fileDirection;
		var turnPawns = this.getPieceColorBitboard(Chess.Piece.PAWN, turnColor);
		var lastRow = Bitboard.RANKS[turnColor ? 0 : Chess.LAST_RANK];
	
		if (!onlyCaptures) {
			var doublePawnPushed = turnPawns.dup().and(Bitboard.RANKS[turnColor ? 6 : 1]).shiftLeft(2 * rankDirection).and_not(occupied).and_not(occupied.dup().shiftLeft(rankDirection));
			addPawnMoves(doublePawnPushed, 2 * rankDirection, Controller.Kind.DOUBLE_PAWN_PUSH);
			var positionalPawnMoved = turnPawns.dup().shiftLeft(rankDirection).and_not(occupied);
			addPawnMoves(positionalPawnMoved.dup().and_not(lastRow), rankDirection, Controller.Kind.POSITIONAL);
			addPawnPromotions(positionalPawnMoved.dup().and(lastRow), rankDirection, false);
		}
	
		var leftFile = Bitboard.FILES[turnColor ? Chess.LAST_FILE : 0];
		var leftCaptureMovement = rankDirection - fileDirection;
		var pawnLeftCaptured = turnPawns.dup().and_not(leftFile).shiftLeft(leftCaptureMovement).and(opponentBB);
		addPawnMoves(pawnLeftCaptured.dup().and_not(lastRow), leftCaptureMovement, Controller.Kind.CAPTURE);
		addPawnPromotions(pawnLeftCaptured.dup().and(lastRow), leftCaptureMovement, true);
	
		var rightFile = Bitboard.FILES[turnColor ? 0 : Chess.LAST_FILE];
		var rightCaptureMovement = rankDirection + fileDirection;
		var pawnRightCaptured = turnPawns.dup().and_not(rightFile).shiftLeft(rightCaptureMovement).and(opponentBB);
		addPawnMoves(pawnRightCaptured.dup().and_not(lastRow), rightCaptureMovement, Controller.Kind.CAPTURE);
		addPawnPromotions(pawnRightCaptured.dup().and(lastRow), rightCaptureMovement, true);
	
		if (this.canEnPassant()) {
			var pawnLeftEnPassant = Bitboard.makeIndex(this.getEnPassantSquare() + fileDirection).and(turnPawns).and_not(leftFile).shiftLeft(leftCaptureMovement);
			addPawnMoves(pawnLeftEnPassant, leftCaptureMovement, Controller.Kind.EN_PASSANT_CAPTURE);
			var pawnRightEnPassant = Bitboard.makeIndex(this.getEnPassantSquare() - fileDirection).and(turnPawns).and_not(rightFile).shiftLeft(rightCaptureMovement);
			addPawnMoves(pawnRightEnPassant, rightCaptureMovement, Controller.Kind.EN_PASSANT_CAPTURE);
		}
		function addNormalMoves(from, toMask, piece) {
			while (!toMask.isEmpty()) {
				var to = toMask.extractLowestBitPosition();
				moves.push(new Controller(from, to, opponentBB.isSet(to) ? Controller.Kind.CAPTURE : Controller.Kind.POSITIONAL, piece, chessPosition.getPieceAtOrNull(to)));
			}
		}
	
		var mask = this.getColorBitboard(turnColor).dup().not();
		if (onlyCaptures) {
			mask.and(opponentBB);
		}
	
		var turnKnights = this.getPieceColorBitboard(Chess.Piece.KNIGHT, turnColor).dup();
		while (!turnKnights.isEmpty()) {
			var knightPosition = turnKnights.extractLowestBitPosition();
			addNormalMoves(knightPosition, Bitboard.KNIGHT_MOVEMENTS[knightPosition].dup().and(mask), Chess.Piece.KNIGHT);
		}
	
		var turnQueens = this.getPieceColorBitboard(Chess.Piece.QUEEN, turnColor).dup();
		while (!turnQueens.isEmpty()) {
			var queenPosition = turnQueens.extractLowestBitPosition();
			addNormalMoves(queenPosition, Position.makeBishopAttackMask(Bitboard.makeIndex(queenPosition), occupied).or(
				Position.makeRookAttackMask(Bitboard.makeIndex(queenPosition), occupied)).and(mask), Chess.Piece.QUEEN);
		}
	
		var turnBishops = this.getPieceColorBitboard(Chess.Piece.BISHOP, turnColor).dup();
		while (!turnBishops.isEmpty()) {
			var bishopPosition = turnBishops.extractLowestBitPosition();
			addNormalMoves(bishopPosition, Position.makeBishopAttackMask(Bitboard.makeIndex(bishopPosition), occupied).and(mask), Chess.Piece.BISHOP);
		}
	
		var turnRooks = this.getPieceColorBitboard(Chess.Piece.ROOK, turnColor).dup();
		while (!turnRooks.isEmpty()) {
			var rookPosition = turnRooks.extractLowestBitPosition();
			addNormalMoves(rookPosition, Position.makeRookAttackMask(Bitboard.makeIndex(rookPosition), occupied).and(mask), Chess.Piece.ROOK);
		}
	
		var kingPosition = this.getKingPosition(turnColor);
		addNormalMoves(kingPosition, Bitboard.KING_MOVEMENTS[kingPosition].dup().and(mask), Chess.Piece.KING);
	
		if (!onlyCaptures) {
			if (this.canCastle(turnColor, true, true)) {
				moves.push(new Controller(kingPosition, kingPosition + 2, Controller.Kind.KING_CASTLE, Chess.Piece.KING, null));
			}
	
			if (this.canCastle(turnColor, false, true)) {
				moves.push(new Controller(kingPosition, kingPosition - 2, Controller.Kind.QUEEN_CASTLE, Chess.Piece.KING, null));
			}
		}
		return moves;
	}

	capturePiece(piece, color, index) {
		this.getPieceBitboard(piece).clearBit(index);
		this.getColorBitboard(color).clearBit(index);
		this.pieces[index] = null;
		this.hashKey.updatePieceColorSquare(piece, color, index);
	}

	unCapturePiece(piece, color, index) {
		this.getPieceBitboard(piece).setBit(index);
		this.getColorBitboard(color).setBit(index);
		this.pieces[index] = (piece);
		this.hashKey.updatePieceColorSquare(piece, color, index);
	}

	movePiece = function(piece, color, from, to) {
		var fromToBB = Bitboard.makeIndex(from).or(Bitboard.makeIndex(to));
		this.getPieceBitboard(piece).xor(fromToBB);
		this.getColorBitboard(color).xor(fromToBB);
		this.pieces[from] = null;
		this.pieces[to] = (piece);
		this.hashKey.updatePieceColorSquare(piece, color, from);
		this.hashKey.updatePieceColorSquare(piece, color, to);
	}

	castleRook(color, kingSide) {
		var from = Position.getCastlingRookSquare(color, kingSide);
		var to = from + (kingSide ? -2 : 3);
		this.movePiece(Chess.Piece.ROOK, color, from, to);
	}

	unCastleRook(color, kingSide) {
		var to = Position.getCastlingRookSquare(color, kingSide);
		var from = to + (kingSide ? -2 : 3);
		this.movePiece(Chess.Piece.ROOK, color, from, to);
	}

	promotePiece(pieceOld, pieceNew, color, index) {
		this.getPieceBitboard(pieceOld).clearBit(index);
		this.getPieceBitboard(pieceNew).setBit(index);
		this.pieces[index] = (pieceNew);
		this.hashKey.updatePieceColorSquare(pieceOld, color, index);
		this.hashKey.updatePieceColorSquare(pieceNew, color, index);
	}

	updatePieces(move) {
		if (move.isCapture()) {
			this.capturePiece(move.getCapturedPiece(), Chess.getOtherPieceColor(this.getTurnColor()), move.getCaptureSquare());
		}
	
		if (move.isCastle()) {
			this.castleRook(this.getTurnColor(), move.getKind() === Controller.Kind.KING_CASTLE);
		}
	
		this.movePiece(move.getPiece(), this.getTurnColor(), move.getFrom(), move.getTo());
	
		if (move.isPromotion()) {
			this.promotePiece(Chess.Piece.PAWN, move.getPromotedPiece(), this.getTurnColor(), move.getTo());
		}
	}

	revertPieces(move) {
		if (move.isPromotion()) {
			this.promotePiece(move.getPromotedPiece(), Chess.Piece.PAWN, this.getTurnColor(), move.getTo());
		}
	
		this.movePiece(move.getPiece(), this.getTurnColor(), move.getTo(), move.getFrom());
	
		if (move.isCastle()) {
			this.unCastleRook(this.getTurnColor(), move.getKind() === Controller.Kind.KING_CASTLE);
		}
	
		if (move.isCapture()) {
			this.unCapturePiece(move.getCapturedPiece(), Chess.getOtherPieceColor(this.getTurnColor()), move.getCaptureSquare());
		}
	}

	isMoveLegal(move) {
		this.updatePieces(move);
		var kingInCheck = this.isKingInCheck();
		this.revertPieces(move);
		return !kingInCheck;
	}

	makeMove(move) {
		this.hashHistory.push(this.hashKey.dup());
		this.updatePieces(move);
	
		if (this.isKingInCheck()) {
			this.revertPieces(move);
			this.hashHistory.pop();
			return false;
		}
	
		this.madeMoves.push(move);
		this.irreversibleHistory.push(this.enPassantSquare);
		this.irreversibleHistory.push(this.castlingRights);
		this.irreversibleHistory.push(this.halfmoveClock);
	
		this.hashKey.updateEnPassantSquare(this.enPassantSquare);
		if (move.getKind() === Controller.Kind.DOUBLE_PAWN_PUSH) {
			this.enPassantSquare = move.getTo();
		} else {
			this.enPassantSquare = -1;
		}
		this.hashKey.updateEnPassantSquare(this.enPassantSquare);
	
		var turnColor = this.getTurnColor();
	
		if (move.getPiece() === Chess.Piece.KING) {
			this.clearCastlingRight(turnColor, true);
			this.clearCastlingRight(turnColor, false);
		} else if (move.getPiece() === Chess.Piece.ROOK) {
			if (move.getFrom() === Position.getCastlingRookSquare(turnColor, true)) {
				this.clearCastlingRight(turnColor, true);
			} else if (move.getFrom() === Position.getCastlingRookSquare(turnColor, false)) {
				this.clearCastlingRight(turnColor, false);
			}
		}
	
		var otherColor = Chess.getOtherPieceColor(turnColor);
	
		if (move.getCapturedPiece() === Chess.Piece.ROOK) {
			if (move.getCaptureSquare() === Position.getCastlingRookSquare(otherColor, true)) {
				this.clearCastlingRight(otherColor, true);
			} else if (move.getCaptureSquare() === Position.getCastlingRookSquare(otherColor, false)) {
				this.clearCastlingRight(otherColor, false);
			}
		}
	
		if (move.isCapture() || move.getPiece() === Chess.Piece.PAWN) {
			this.halfmoveClock = 0;
		} else {
			++this.halfmoveClock;
		}
	
		this.turn = otherColor;
		this.hashKey.updateTurn();
	
		return true;
	}

	getMadeMoveCount() {
		return this.madeMoves.length;
	}

	canUndo() {
		return !!this.getMadeMoveCount();
	}

	getLastMove() {
		if (!this.canUndo()) {
			return null;
		}
	
		return this.madeMoves[this.madeMoves.length - 1];
	}

	unmakeMove() {
		if (!this.canUndo()) {
			return null;
		}
		var move = (this.madeMoves.pop());
		this.turn = Chess.getOtherPieceColor(this.getTurnColor());
		this.hashKey.updateTurn();
		this.revertPieces(move);
		this.halfMoveClock = (this.irreversibleHistory.pop());
		this.hashKey.updateCastlingRights(this.castlingRights);
		this.castlingRights = this.irreversibleHistory.pop();
		this.hashKey.updateCastlingRights(this.castlingRights);
		this.hashKey.updateEnPassantSquare(this.enPassantSquare);
		this.enPassantSquare = this.irreversibleHistory.pop();
		this.hashKey.updateEnPassantSquare(this.enPassantSquare);
		this.hashHistory.pop();
	
		return move;
	}
}


