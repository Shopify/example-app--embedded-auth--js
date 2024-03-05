var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', async function (req, res, next) {
  const searchParams = new URLSearchParams(req.query);
  res.redirect(`/authorize?${searchParams.toString()}`);
});

module.exports = router;
