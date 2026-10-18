// Local Services harness: isolated fixtures, never production Redis or data.
require("./services-local.cjs");
const app = require("./services.cjs");
app.listen(Number(process.env.PORT || 4000), "127.0.0.1");
