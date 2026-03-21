const fetch = require('node-fetch');

async function test() {
    const url = 'https://script.google.com/macros/s/AKfycbzJUIZ3bwYX8q_O_MtswE5zKVviB7H5tqANeLQbuJL2CHVZij2UbFvO_UC0BppR4EePFw/exec?action=getRole';
    try {
        const res = await fetch(url);
        const text = await res.text();
        console.log("Response:", text);
    } catch (err) {
        console.error("Error:", err);
    }
}

test();
