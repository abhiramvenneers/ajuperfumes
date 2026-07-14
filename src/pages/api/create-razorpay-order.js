import { Buffer } from 'buffer';

export const prerender = false;

/**
 * Astro POST API Route to securely generate a Razorpay order from the server side.
 * This prevents exposure of your secret API key on the client browser.
 */
export async function POST({ request }) {
    try {
        const body = await request.json();
        const { amount } = body; // Amount in INR Rupees

        // Pull key details securely from the hosting environment
        const keyId = import.meta.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
        const keySecret = import.meta.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;

        if (!keyId || !keySecret) {
            return new Response(JSON.stringify({ 
                error: "Razorpay credentials are not defined in the server environment variables." 
            }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        // Razorpay expects pricing transactions represented in Paise (1 Rupee = 100 Paise)
        const amountInPaise = Math.round(parseFloat(amount) * 100);

        if (isNaN(amountInPaise) || amountInPaise <= 0) {
            return new Response(JSON.stringify({ error: "Invalid transaction amount specified." }), { status: 400 });
        }

        // Encode API credentials securely into Basic Auth header
        const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');

        const response = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: amountInPaise,
                currency: 'INR',
                receipt: `order_rcpt_${Date.now()}`
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.description || 'Failed to communicate with Razorpay servers.');
        }

        // Return the successfully created order block containing the ID back to the client-side browser
        return new Response(JSON.stringify(data), { 
            status: 200, 
            headers: { 'Content-Type': 'application/json' } 
        });

    } catch (e) {
        console.error("Razorpay Server Order Generation Crash:", e);
        return new Response(JSON.stringify({ error: e.message }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
}