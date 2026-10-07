const http = require("http");
const fs = require("fs");
const path = require("path");

const server = http.createServer((req, res) => {
    if (req.url === "/"){
      const filepath = path.join(__dirname, "..", "src\\index.html");

      fs.readFile(filepath, (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end("Wystąpił problem z wczytaniem strony.");
          return;
        }

        res.writeHead(200, {"Content-Type": "text/html"});
        res.end(data);
      });
    }
    else
    {
      res.writeHead(404);
      res.end("Nie Znaleziono");
    }
});

server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});