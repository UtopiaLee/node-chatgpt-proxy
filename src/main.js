const express = require('express')
const app = express()
const port = 3000

const {getOpenAIAuth} = require("./browser/openai-auth");
const {sendRequestFull, sendRequestNormal} = require('./chatgpt/proxy')
// const delay = require("delay");
const {ChatGPTPuppeteer} = require("./browser/full-browser");
app.use(express.json())

app.post('/backend-api/conversation', async function (req, res) {
    res.set({
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    let success = false
    sendRequestFull('/backend-api/conversation', req.method, req.body, JSON.parse(JSON.stringify(req.headers)), data => {
        if (!success && data) {
            success = true
            res.set('Content-Type', 'text/event-stream');
            res.write('Starting SSE stream...\n');
            res.flushHeaders()
        }
        // console.log(data)
        res.write(`data: ${data}\n\n`)
        if (data === '[DONE]') {
            res.end()
        }
    }).then(result => {
        if (result?.error) {
            res.status(result.error.statusCode);
            res.send(result)
        }
    }).catch(err => {
        console.log(err)
        res.send(err)
        res.status(err.statusCode || 500).end();
    })
})
app.all("/*", async (req, res) => {
    let body = req.body
    let uri = req.path
    let headers = JSON.parse(JSON.stringify(req.headers))
    res.set('Cache-Control', 'no-cache');
    console.log('request: ' + uri)
    let newHeaders = {
        'content-type': 'application/json',
        'x-openai-assistant-app-id': '',
        "accept": "application/json",
        'authorization': headers['authorization']
    }
    let response = await sendRequestNormal(uri, req.method, body, newHeaders)
    // res.set('Content-Type', 'application/json');
    console.log(response);
    // if(null==response.status|| undefined==response.status)
    // {
    //     res.status(200)
    // }
    // else
    // {
    // res.status(response.status)
    // }
    try{
        res.status(response.status)
    }catch(e)
    {
       res.status(200);
    }
    res.send(response)
})
global.lock = 0;
global.processingCount = 0;
global.CFStatus = false
global.init = false
global.cgp = new ChatGPTPuppeteer()
global.cgp.init().then(res => {
    getOpenAIAuth({}).then(res => {
        console.log('first start up, fetch cloudflare token')
        global.CFStatus = true
        global.init = true
    })
})
setInterval(async () => {
    // console.log({lock, processingCount})
    if (global.init && !global.CFStatus) {
        global.init = false
        try {
            getOpenAIAuth({}).then(res => {
                console.log('need refresh, fetch cloudflare token')
                global.CFStatus = true
                global.init = true
            }).catch(err => {
                console.warn(err)
                global.init = true
            })
        } catch (err) {
            console.warn(err)
            global.init = true
        }

    }
}, 500)
app.listen(port, () => {
    console.log(`node-chatgpt-proxy listening on port ${port}`)
});