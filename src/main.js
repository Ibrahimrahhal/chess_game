import UIChessBoard from "./ui.js";

$(function makeChessGame() {
  UIChessBoard.makeBoard();
  var ui = new UIChessBoard();
  ui.updateChessPosition();
  window.ui = ui;
});
