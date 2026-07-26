module.exports = (_context, basicIO) => {
  basicIO.write(JSON.stringify({ status: "ok", service: "ksp-crime-intelligence" }));
  basicIO.close();
};