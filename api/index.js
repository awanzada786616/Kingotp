const axios = require('axios');
const cheerio = require('cheerio');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

const base_url = 'https://tempail.top';

export default async function handler(req, res) {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-temp-cookies');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const jar = new CookieJar();
    // Trick: Agar browser se purani cookies aayi hain toh unhe use karo
    const incomingCookies = req.headers['x-temp-cookies'];
    if (incomingCookies) {
        const cookieArray = JSON.parse(incomingCookies);
        cookieArray.forEach(c => jar.setCookieSync(c, base_url));
    }

    const session = wrapper(axios.create({
        jar,
        withCredentials: true,
        headers: {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'X-Requested-With': 'XMLHttpRequest'
        }
    }));

    try {
        // 1. Get CSRF Token
        const home = await session.get(base_url);
        const $ = cheerio.load(home.data);
        const csrf = $('meta[name="csrf-token"]').attr('content') || $('input[name="_token"]').val();

        // 2. Fetch Messages
        const response = await session.post(
            `${base_url}/messages?${Date.now()}`,
            `_token=${csrf}`,
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' } }
        );

        // 3. Return Data + New Cookies
        const currentCookies = jar.getCookiesSync(base_url).map(c => c.toString());
        res.status(200).json({
            data: response.data,
            cookies: JSON.stringify(currentCookies)
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
