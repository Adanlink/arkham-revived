const express = require("express");
const fse = require("fs-extra");

const router = express.Router();
const netvars = fse.readFileSync("./basecfg/netvars.dat").toString("base64");

router.get("/netvars.dat", function(req, res) {
    const response = {
        "data": netvars,
    };
    res.json(response);
});

module.exports = router;
