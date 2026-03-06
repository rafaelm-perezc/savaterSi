const poolObj = require('./src/backend/config/mysql');

async function testConnection() {
    try {
        console.log("Testing connection...");
        // Since the exported module is a Proxy, awaiting a method call will trigger the pool creation
        // We can just execute a simple ping query
        const [rows] = await poolObj.query('SELECT 1 as test_val');
        console.log("SUCCESS! Database responded with:", rows[0].test_val);
        process.exit(0);
    } catch (err) {
        console.error("FAILED to connect or query:", err.message);
        process.exit(1);
    }
}

testConnection();
