import express from "express";
import employeeRoutes from "./employees/employee.routes.js";

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    return res.json({
        message: "Employee Routes API",
    });
});

app.use("/employees", employeeRoutes);

export default app;