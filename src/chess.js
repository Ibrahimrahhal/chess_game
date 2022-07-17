export default class Chess {
  static RANKS = 8; // rows
  static LAST_RANK = this.RANKS - 1;
  static FILES = 8; // columns
  static LAST_FILE = this.FILES - 1;
  static FILE_CHARACTERS = "abcdefgh";
  static RANK_CHARACTERS = "12345678";
  static Piece = {
    PAWN: 0,
    KNIGHT: 1,
    BISHOP: 2,
    ROOK: 3,
    QUEEN: 4,
    KING: 5,
  };
  static PieceColor = {
    WHITE: 0,
    BLACK: 1,
  };
  static PIECE_NAMES = ["pawn", "knight", "bishop", "rook", "queen", "king"];
  static PIECE_ALGEBRAIC_NAMES = " NBRQK";
  static PIECE_CHARACTERS =
    "\u2659\u265F\u2658\u265E\u2657\u265D\u2656\u265C\u2655\u265B\u2654\u265A";

  static getRank(index) {
    return index >>> 3;
  }

  static getFile(index) {
    return index & 7;
  }

  static isInsideBoard(rank, file) {
    return !((rank | file) & ~7);
  }

  static getIndex(rank, file) {
    return file + rank * this.FILES;
  }

  static isInsideBoard(rank, file) {
    return !((rank | file) & ~7);
  }

  static getIndex(rank, file) {
    return file + rank * this.FILES;
  }

  static isLight(rank, file) {
    return !!((rank + file) % 2);
  }

  static getAlgebraic(rank, file) {
    return this.FILE_CHARACTERS[file] + this.RANK_CHARACTERS[rank];
  }

  static getIndexFromAlgebraic(algebraic) {
    var file = this.FILE_CHARACTERS.indexOf(algebraic[0]);
    var rank = this.RANK_CHARACTERS.indexOf(algebraic[1]);
    return this.getIndex(rank, file);
  }

  static getAlgebraicFromIndex(index) {
    return this.getAlgebraic(this.getRank(index), this.getFile(index));
  }

  static getPieceCharacter(piece, color) {
    return this.PIECE_CHARACTERS.charAt(piece * 2 + color);
  }

  static getOtherPieceColor(color) {
    return color ^ 1;
  }
}
