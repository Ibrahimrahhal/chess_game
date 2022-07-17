import Position from "./position.js";
import Chess from "./chess.js";
import Controller from "./controller.js";

export default class UIChessBoard {
  static CHESSBOARD_ID = "#chessboard";
  static CHESSBOARD_TABLE = this.CHESSBOARD_ID + " table";
  static CHESSBOARD_SQUARE = this.CHESSBOARD_ID + " table tr td";
  static CHESSBOARD_PIECE = this.CHESSBOARD_SQUARE + " div";
  static CHESSBOARD_PIECES_AND_SQUARES =
    this.CHESSBOARD_SQUARE + ", " + this.CHESSBOARD_PIECE;

  constructor() {
    this.chessPosition = new Position();
  }

  static makeBoard() {
    var table = $("<table>");
    var filesRow =
      "<tr><th></th>" +
      "abcdefgh"
        .split("")
        .map(function (x) {
          return '<th class="file">' + x + "</th>";
        })
        .join("") +
      "<th></th></tr>";
    table.append(filesRow);

    for (var row = 0; row < Chess.RANKS; ++row) {
      var rank = Chess.LAST_RANK - row;
      var tr = $("<tr>");
      table.append(tr);

      var rankCell = '<th class="rank">' + (Chess.RANKS - row) + "</th>";
      tr.append(rankCell);

      for (var file = 0; file < Chess.FILES; ++file) {
        var td = $("<td>");
        var color = Chess.isLight(rank, file) ? "light" : "dark";
        td.attr("id", Chess.getAlgebraic(rank, file));
        td.attr(
          "title",
          "Algebraic: " +
            Chess.getAlgebraic(rank, file) +
            "\nRank: " +
            rank +
            "\nFile: " +
            file +
            "\nIndex: " +
            Chess.getIndex(rank, file) +
            "\nColor: " +
            color
        );
        td.addClass(color);
        tr.append(td);
      }

      tr.append(rankCell);
    }

    table.append(filesRow);
    $(UIChessBoard.CHESSBOARD_ID).append(table);
  }

  static clearMoving() {
    $(UIChessBoard.CHESSBOARD_PIECES_AND_SQUARES).removeClass(
      "from to positional capture double-push en-passant promotion castle king-castle queen-castle"
    );
  }

  static clearDragging() {
    $(UIChessBoard.CHESSBOARD_PIECE + ".ui-draggable").draggable("destroy");
    $(UIChessBoard.CHESSBOARD_SQUARE + ".ui-droppable").droppable("destroy");
  }

  updatePieces() {
    $(UIChessBoard.CHESSBOARD_PIECE).remove();
    $(UIChessBoard.CHESSBOARD_SQUARE).removeClass(
      "white black turn last-move " + Chess.PIECE_NAMES.join(" ")
    );

    var whites = this.chessPosition.getColorBitboard(Chess.PieceColor.WHITE);
    var blacks = this.chessPosition.getColorBitboard(Chess.PieceColor.BLACK);

    for (var index = 0; index < Chess.RANKS * Chess.FILES; ++index) {
      var td = $("#" + Chess.getAlgebraicFromIndex(index));

      for (var piece = Chess.Piece.PAWN; piece <= Chess.Piece.KING; ++piece) {
        if (this.chessPosition.getPieceBitboard(piece).isSet(index)) {
          var isTurn =
            this.chessPosition.getTurnColor() === Chess.PieceColor.WHITE
              ? whites.isSet(index)
              : blacks.isSet(index);

          var div = $("<div>");
          div.attr(
            "title",
            td.attr("title") +
              "\nPiece: " +
              Chess.PIECE_NAMES[piece] +
              "\nColor: " +
              (whites.isSet(index) ? "white" : "black")
          );
          div.text(
            Chess.getPieceCharacter(
              piece,
              whites.isSet(index)
                ? Chess.PieceColor.WHITE
                : Chess.PieceColor.BLACK
            )
          );

          var elements = div.add(td);
          elements.addClass(Chess.PIECE_NAMES[piece]);
          elements.toggleClass("white", whites.isSet(index));
          elements.toggleClass("black", blacks.isSet(index));
          elements.toggleClass("turn", isTurn);

          td.append(div);

          break;
        }
      }
    }

    var lastMove = this.chessPosition.getLastMove();
    if (lastMove !== null) {
      $("#" + Chess.getAlgebraicFromIndex(lastMove.getFrom())).addClass(
        "last-move"
      );
      $("#" + Chess.getAlgebraicFromIndex(lastMove.getTo())).addClass(
        "last-move"
      );
    }
  }

  updateMoves() {
    var moves = this.chessPosition.getMoves();

    $("#moves").html(
      '<a href="#" id="undo" class="' +
        (this.chessPosition.canUndo() ? "can" : "cannot") +
        '">undo</a><br/>' +
        '<a href="#" id="auto" class="' +
        (moves.length > 0 ? "can" : "cannot") +
        '">auto</a><br/>' +
        moves
          .map(function (move, index) {
            return (
              '<a href="#" id="' + index + '">' + move.getString() + "</a><br/>"
            );
          })
          .join("")
    );

    $(UIChessBoard.CHESSBOARD_PIECES_AND_SQUARES).removeClass("can-move");
    moves.forEach(function (move) {
      var td = $("#" + Chess.getAlgebraicFromIndex(move.getFrom()));
      var elements = td.add(td.children());
      elements.addClass("can-move");
    });

    var dragging = false;
    var ui = this;

    $(UIChessBoard.CHESSBOARD_PIECE + ".can-move")
      .mouseenter(function (event) {
        if (dragging) {
          return;
        }

        var div = $(this);
        var td = div.parent();
        var from = Chess.getIndexFromAlgebraic("" + td.attr("id"));
        var fromElements = td.add(div);
        fromElements.toggleClass(
          "from",
          moves.some(function (move) {
            return move.getFrom() === from;
          })
        );

        if (fromElements.hasClass("from")) {
          moves.forEach(function (move) {
            if (move.getFrom() === from) {
              var toElements = $(
                "#" + Chess.getAlgebraicFromIndex(move.getTo())
              );
              toElements = toElements.add(toElements.children());
              toElements.addClass("to");
              toElements.addClass(
                move.getKind() === Controller.Kind.POSITIONAL
                  ? "positional"
                  : ""
              );
              toElements.addClass(move.isCapture() ? "capture" : "");
              toElements.addClass(
                move.getKind() === Controller.Kind.DOUBLE_PAWN_PUSH
                  ? "double-push"
                  : ""
              );
              toElements.addClass(
                move.getKind() === Controller.Kind.EN_PASSANT_CAPTURE
                  ? "en-passant"
                  : ""
              );
              toElements.addClass(move.isPromotion() ? "promotion" : "");
              toElements.addClass(move.isCastle() ? "castle" : "");
              toElements.addClass(
                move.getKind() === Controller.Kind.KING_CASTLE
                  ? "king-castle"
                  : ""
              );
              toElements.addClass(
                move.getKind() === Controller.Kind.QUEEN_CASTLE
                  ? "queen-castle"
                  : ""
              );
            }
          });

          UIChessBoard.clearDragging();

          // Quote "drop", "start", "stop", etc to prevent the closure compiler from removing them
          $(UIChessBoard.CHESSBOARD_SQUARE + ".to").droppable({
            drop: function () {
              var to = Chess.getIndexFromAlgebraic("" + $(this).attr("id"));
              var makeMoves = moves.filter(function (move) {
                return move.getFrom() === from && move.getTo() === to;
              });

              if (makeMoves.length > 0) {
                ui.chessPosition.makeMove(makeMoves[0]);
                ui.updateChessPosition();
              } else {
                UIChessBoard.clearMoving();
                UIChessBoard.clearDragging();
              }
            },
          });

          div.draggable({
            start: function () {
              dragging = true;
            },
            stop: function () {
              dragging = false;
            },
            containment: UIChessBoard.CHESSBOARD_TABLE,
            zIndex: 10,
            revert: "invalid",
          });
        }
      })
      .mouseleave(function () {
        if (!dragging) {
          UIChessBoard.clearMoving();
        }
      });

    $("#moves a").click(function () {
      var id = $(this).attr("id");
      if (id === "undo") {
        ui.chessPosition.unmakeMove(); // (black) move
        ui.chessPosition.unmakeMove(); // (white) move
        ui.updateChessPosition();
      } else if (id === "auto") {
        alert("auto should call api to determine next move");
      } else {
        ui.chessPosition.makeMove(moves[parseInt(id, 10)]);
        ui.updateChessPosition();
      }
    });
  }

  updateChessPosition() {
    UIChessBoard.clearMoving();
    UIChessBoard.clearDragging();
    this.updatePieces();

    var status = this.chessPosition.getStatus();
    this.updateMoves();
    $("#dim").css({ display: "none" });

    if (status === Position.Status.CHECKMATE) {
      $("#moves").append(
        "&#35;<br/>" + (this.chessPosition.getTurnColor() ? "1-0" : "0-1")
      );
    } else if (status !== Position.Status.NORMAL) {
      $("#moves").append("&frac12;-&frac12;");
    }
  }
}
