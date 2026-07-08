import { supabase } from '../../lib/supabase.js';

export const prerender = false;

// Helper function to send high-end, responsive HTML invoices via Resend API
async function sendEmailNotification(toEmail, customerName, orderId, orderData) {
    const RESEND_API_KEY = import.meta.env.RESEND_API_KEY; 
    
    if (!RESEND_API_KEY) {
        console.log("\n❌ EMAIL ABORTED: RESEND_API_KEY is missing in your environment!");
        console.log("Please define this in your Vercel Dashboard or local .env file.\n");
        return;
    }

    console.log(`\n✉️ Compiling premium HTML invoice for: ${toEmail}...`);

    try {
        // Extract items array and total calculation
        const items = Array.isArray(orderData.items) ? orderData.items : [];
        const totalAmount = Number(orderData.total_amount || 0);

        // Build itemized invoice rows safely for strict HTML email clients
        const itemsHtml = items.map(item => {
            const name = item.name || 'Signature Fragrance';
            const qty = item.quantity || 1;
            const price = Number(item.price || 0);
            return `
                <tr style="border-bottom: 1px solid #f0f0f0;">
                    <td style="padding: 12px 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 13px; color: #111111; text-align: left;">
                        <strong style="font-weight: 500; color: #000000;">${name}</strong><br/>
                        <span style="font-size: 11px; color: #888888; text-transform: uppercase; letter-spacing: 0.05em;">Volume: ${item.volume || '50ml'}</span>
                    </td>
                    <td style="padding: 12px 0; text-align: center; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 13px; color: #666666;">
                        ${qty}
                    </td>
                    <td style="padding: 12px 0; text-align: right; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 13px; color: #111111; font-weight: 600;">
                        ₹${(price * qty).toLocaleString('en-IN')}
                    </td>
                </tr>
            `;
        }).join('');

        // Clean up the delivery address and parse the transaction logs
        const cleanAddress = orderData.shipping_address.split(' [PAID')[0];
        let paymentBadge = 'Verified Transaction';
        
        const paymentMatch = orderData.shipping_address.match(/\[PAID VIA (UPI|CARD) \| (UTR: \d+|Card ending in \d+)\]/i);
        if (paymentMatch) {
            paymentBadge = paymentMatch[0].slice(1, -1).replace('PAID VIA ', '');
        }

        const orderDate = new Date().toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        // Responsive, cross-client optimized HTML Invoice Template
        const emailBodyHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Invoice #${orderId}</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #fcfcfc; -webkit-text-size-adjust: none; -ms-text-size-adjust: none;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fcfcfc; padding: 40px 10px;">
                    <tr>
                        <td align="center">
                            <!-- Invoice Wrapper Card -->
                            <table width="100%" class="content-table" style="max-width: 600px; background-color: #ffffff; border: 1px solid #ebebeb; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.02); padding: 40px;" cellpadding="0" cellspacing="0">
                                
                                <!-- Brand Header -->
                                <tr>
                                    <td>
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom: 2px solid #111111; padding-bottom: 25px; margin-bottom: 35px;">
                                            <tr>
                                                <td style="text-align: left;">
                                                    <h1 style="font-family: 'Georgia', serif; font-size: 26px; font-weight: bold; letter-spacing: 0.2em; text-transform: uppercase; margin: 0; color: #000000;">AJU</h1>
                                                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #888888; font-weight: bold; display: block; margin-top: 4px;">Official Digital Invoice</span>
                                                </td>
                                                <td style="text-align: right; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.6; color: #555555;">
                                                    <p style="margin: 0; font-weight: bold; color: #000000;">Order Ref: #000${orderId}</p>
                                                    <p style="margin: 2px 0 0 0;">Date: ${orderDate}</p>
                                                    <p style="margin: 2px 0 0 0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: bold; color: #16a34a;">${paymentBadge}</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Split Shipping / Billing Table -->
                                <tr>
                                    <td>
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 35px;">
                                            <tr>
                                                <!-- Left: Recipient Destination -->
                                                <td width="50%" valign="top" style="padding-right: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.5; color: #444444;">
                                                    <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.12em; color: #888888; margin-bottom: 10px; border-bottom: 1px solid #f0f0f0; padding-bottom: 4px;">Billing & Shipping To</div>
                                                    <strong style="font-family: 'Georgia', serif; font-size: 14px; color: #111111; display: block; margin-bottom: 4px;">${customerName}</strong>
                                                    <p style="margin: 2px 0;">${toEmail}</p>
                                                    <p style="margin: 2px 0; color: #555555;">${cleanAddress}</p>
                                                </td>
                                                <!-- Right: Merchant details -->
                                                <td width="50%" valign="top" style="padding-left: 20px; text-align: right; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.5; color: #444444;">
                                                    <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.12em; color: #888888; margin-bottom: 10px; border-bottom: 1px solid #f0f0f0; padding-bottom: 4px; text-align: right;">Merchant House</div>
                                                    <strong style="font-family: 'Georgia', serif; font-size: 14px; color: #111111; display: block; margin-bottom: 4px;">Aju Perfumes</strong>
                                                    <p style="margin: 2px 0;">perfumesaju@gmail.com</p>
                                                    <p style="margin: 2px 0;">Kerala, India</p>
                                                    <p style="margin: 2px 0; font-weight: 500; color: #111111;">Contact: +91 8075304432</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Product breakdown list -->
                                <tr>
                                    <td>
                                        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.12em; color: #888888; margin-bottom: 15px; border-bottom: 1px solid #f0f0f0; padding-bottom: 4px;">Purchased Fragrances</div>
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 30px;">
                                            <thead>
                                                <tr style="border-bottom: 1px solid #111111;">
                                                    <th align="left" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; color: #888888; padding-bottom: 8px;">Fragrance Details</th>
                                                    <th align="center" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; color: #888888; padding-bottom: 8px; width: 15%;">Qty</th>
                                                    <th align="right" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; color: #888888; padding-bottom: 8px; width: 25%;">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${itemsHtml}
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Total Pricing Table -->
                                <tr>
                                    <td>
                                        <table width="50%" align="right" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 30px;">
                                            <tr>
                                                <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #777777; padding: 6px 0;">Subtotal</td>
                                                <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 500; color: #111111; text-align: right; padding: 6px 0;">₹${totalAmount.toLocaleString('en-IN')}</td>
                                            </tr>
                                            <tr>
                                                <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #777777; padding: 6px 0;">Shipping</td>
                                                <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: bold; text-transform: uppercase; color: #16a34a; text-align: right; padding: 6px 0; letter-spacing: 0.05em;">Complimentary</td>
                                            </tr>
                                            <tr style="border-top: 1px solid #111111;">
                                                <td style="font-family: 'Georgia', serif; font-size: 15px; font-weight: bold; color: #000000; padding: 15px 0 0 0;">Total Amount</td>
                                                <td style="font-family: 'Georgia', serif; font-size: 16px; font-weight: bold; color: #000000; text-align: right; padding: 15px 0 0 0;">₹${totalAmount.toLocaleString('en-IN')}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Footer message -->
                                <tr>
                                    <td align="center" style="border-top: 1px solid #f0f0f0; padding-top: 25px; margin-top: 40px; text-align: center;">
                                        <p style="font-family: 'Georgia', serif; font-style: italic; font-size: 13px; color: #555555; margin: 0 0 10px 0;">Thank you for your appreciation of Aju fine craftsmanship.</p>
                                        <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; color: #999999; margin: 0;">You can track this order status or update your defaults inside your <a href="https://ajuperfumes.com/account" style="color: #000000; text-decoration: underline; font-weight: 500;">Aju Client Portal</a>.</p>
                                    </td>
                                </tr>

                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `;

        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Aju Perfumes <orders@ajuperfumes.com>', // Branded production email
                to: [toEmail],
                subject: `Order Confirmation & Invoice - Aju Perfumes`,
                html: emailBodyHtml
            })
        });

        const resData = await res.json();

        if (!res.ok) {
            console.log("❌ RESEND REJECTED THE INVOICE EMAIL. Reason:");
            console.log(resData);
        } else {
            console.log("✅ PREMIUM INVOICE EMAIL SENT SUCCESSFULLY! Resend ID:", resData.id);
        }

    } catch (error) {
        console.error("❌ Network Error connecting to Resend:", error);
    }
}

export async function POST({ request }) {
    try {
        const orderData = await request.json();
        
        // 1. Insert the order into Supabase including the user_id (if logged in)
        const { data, error } = await supabase.from('orders').insert([{
            customer_name: orderData.customer_name,
            customer_email: orderData.customer_email,
            shipping_address: orderData.shipping_address,
            total_amount: orderData.total_amount,
            items: orderData.items, 
            status: 'placed',
            user_id: orderData.user_id || null
        }]).select();
        
        if (error) {
            console.error("Supabase Checkout Insert Error:", error);
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        // 2. Automated Stock Decrement Loop
        if (orderData.items && Array.isArray(orderData.items)) {
            for (const item of orderData.items) {
                const { data: currentProduct, error: fetchError } = await supabase
                    .from('perfumes')
                    .select('stock_quantity')
                    .eq('id', item.id)
                    .single();

                if (fetchError || !currentProduct) {
                    console.error(`Error querying stock for perfume ID ${item.id}:`, fetchError?.message);
                    continue;
                }

                const decrementedStock = Math.max(0, currentProduct.stock_quantity - (item.quantity || 1));

                const { error: updateError } = await supabase
                    .from('perfumes')
                    .update({ stock_quantity: decrementedStock })
                    .eq('id', item.id);

                if (updateError) {
                    console.error(`Error subtracting stock for perfume ID ${item.id}:`, updateError.message);
                } else {
                    console.log(`Stock successfully decremented. Item #${item.id} new inventory level: ${decrementedStock}`);
                }
            }
        }
        
        // 3. Fallback safely in case Supabase RLS policies block the .select() return
        const newOrder = (data && data.length > 0) 
            ? data[0] 
            : { customer_email: orderData.customer_email, customer_name: orderData.customer_name, id: 'Pending', items: orderData.items, total_amount: orderData.total_amount, shipping_address: orderData.shipping_address };
            
        // 4. Send the responsive HTML invoice email
        await sendEmailNotification(newOrder.customer_email, newOrder.customer_name, newOrder.id, newOrder);
        
        return new Response(JSON.stringify({ success: true }), { status: 200 });
        
    } catch (e) {
        console.error("Checkout Server Error:", e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}