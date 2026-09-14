import app from "./app.js";
import { geocodeAddress } from "./geocoding/geocoding.service.js";

const port = 3000;

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});