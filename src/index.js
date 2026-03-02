require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes/index');
const { notFoundHandler, errorHandler } = require('./middleware/error');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/', routes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
