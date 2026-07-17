import { supabase } from '../../lib/supabase.js';

export const prerender = false;

// Helper function to send high-end, responsive HTML invoices via Resend API
async function sendEmailNotification(toEmail, customerName, orderId, orderData) {
    const RESEND_API_KEY = import.meta.env.RESEND_API_KEY; 
    
    if (!RESEND_API_KEY) {
        console.log("\n❌ EMAIL ABORTED: RESEND_API_KEY is missing in your environment!");
        return;
    }

    try {
        const items = Array.isArray(orderData.items) ? orderData.items : [];
        const totalAmount = Number(orderData.total_amount || 0);

        const itemsHtml = items.map(item => {
            const name = item.name || 'Signature Fragrance';
            const qty = item.quantity || 1;
            const price = Number(item.price || 0);
            return `
                <tr style="border-bottom: 1px solid #f0f0f0;">
                    <td style="padding: 12px 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 13px; color: #111111; text-align: left;">
                        <strong style="font-weight: 500; color: #000000;">${name}</strong><br/>
                        <span style="font-size: 11px; color: #888888; text-transform: uppercase; letter-spacing: 0.05em;">Specs: ${item.volume || 'Standard'}</span>
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

        const emailBodyHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Invoice #${orderId}</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #fcfcfc;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fcfcfc; padding: 40px 10px;">
                    <tr>
                        <td align="center">
                            <table width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #ebebeb; border-radius: 4px; padding: 40px;" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td>
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom: 2px solid #111111; padding-bottom: 25px; margin-bottom: 35px;">
                                            <tr>
                                                <td style="text-align: left;">
                                                    <h1 style="font-family: 'Georgia', serif; font-size: 26px; font-weight: bold; letter-spacing: 0.2em; text-transform: uppercase; margin: 0; color: #000000;">AJU</h1>
                                                    <span style="font-family: sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #888888; font-weight: bold; display: block; margin-top: 4px;">Official Digital Invoice</span>
                                                </td>
                                                <td style="text-align: right; font-family: sans-serif; font-size: 12px; line-height: 1.6; color: #555555;">
                                                    <p style="margin: 0; font-weight: bold; color: #000000;">Order Ref: #000${orderId}</p>
                                                    <p style="margin: 2px 0 0 0;">Date: ${orderDate}</p>
                                                    <p style="margin: 2px 0 0 0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: bold; color: #16a34a;">${paymentBadge}</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 35px;">
                                            <tr>
                                                <td width="50%" valign="top" style="padding-right: 20px; font-family: sans-serif; font-size: 12px; line-height: 1.5; color: #444444;">
                                                    <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.12em; color: #888888; margin-bottom: 10px; border-bottom: 1px solid #f0f0f0; padding-bottom: 4px;">Billing & Shipping To</div>
                                                    <strong style="font-family: 'Georgia', serif; font-size: 14px; color: #111111; display: block; margin-bottom: 4px;">${customerName}</strong>
                                                    <p style="margin: 2px 0;">${toEmail}</p>
                                                    <p style="margin: 2px 0; color: #555555;">${cleanAddress}</p>
                                                </td>
                                                <td width="50%" valign="top" style="padding-left: 20px; text-align: right; font-family: sans-serif; font-size: 12px; line-height: 1.5; color: #444444;">
                                                    <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.12em; color: #888888; margin-bottom: 10px; border-bottom: 1px solid #f0f0f0; padding-bottom: 4px; text-align: right;">Merchant House</div>
                                                    <strong style="font-family: 'Georgia', serif; font-size: 14px; color: #111111; display: block; margin-bottom: 4px;">Aju House</strong>
                                                    <p style="margin: 2px 0;">perfumesaju@gmail.com</p>
                                                    <p style="margin: 2px 0;">Kerala, India</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <div style="font-family: sans-serif; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.12em; color: #888888; margin-bottom: 15px; border-bottom: 1px solid #f0f0f0; padding-bottom: 4px;">Purchased Items</div>
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 30px;">
                                            <thead>
                                                <tr style="border-bottom: 1px solid #111111;">
                                                    <th align="left" style="font-family: sans-serif; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; color: #888888; padding-bottom: 8px;">Product Details</th>
                                                    <th align="center" style="font-family: sans-serif; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; color: #888888; padding-bottom: 8px; width: 15%;">Qty</th>
                                                    <th align="right" style="font-family: sans-serif; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; color: #888888; padding-bottom: 8px; width: 25%;">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${itemsHtml}
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <table width="50%" align="right" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 30px;">
                                            <tr>
                                                <td style="font-family: sans-serif; font-size: 12px; color: #777777; padding: 6px 0;">Subtotal</td>
                                                <td style="font-family: sans-serif; font-size: 12px; font-weight: 500; color: #111111; text-align: right; padding: 6px 0;">₹${totalAmount.toLocaleString('en-IN')}</td>
                                            </tr>
                                            <tr>
                                                <td style="font-family: sans-serif; font-size: 12px; color: #777777; padding: 6px 0;">Shipping</td>
                                                <td style="font-family: sans-serif; font-size: 11px; font-weight: bold; text-transform: uppercase; color: #16a34a; text-align: right; padding: 6px 0; letter-spacing: 0.05em;">Complimentary</td>
                                            </tr>
                                            <tr style="border-top: 1px solid #111111;">
                                                <td style="font-family: 'Georgia', serif; font-size: 15px; font-weight: bold; color: #000000; padding: 15px 0 0 0;">Total</td>
                                                <td style="font-family: 'Georgia', serif; font-size: 16px; font-weight: bold; color: #000000; text-align: right; padding: 15px 0 0 0;">₹${totalAmount.toLocaleString('en-IN')}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `;

        await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Aju House <orders@ajuperfumes.com>',
                to: [toEmail],
                subject: `Order Confirmed & Invoice - Aju House`,
                html: emailBodyHtml
            })
        });

    } catch (error) {
        console.error("❌ Email transmission failure:", error);
    }
}

export async function POST({ request }) {
    try {
        const orderData = await request.json();
        
        // 1. Insert order into database securely linking auth ID
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

        // 2. Automated Relational Stock Decrement Engine (Deducts stock of the exact Variant ID!)
        if (orderData.items && Array.isArray(orderData.items)) {
            for (const item of orderData.items) {
                if (item.variant_id) {
                    const { data: currentVariant, error: fetchError } = await supabase
                        .from('product_variants')
                        .select('stock_quantity')
                        .eq('id', item.variant_id)
                        .single();

                    if (fetchError || !currentVariant) {
                        console.error(`Error checking variant stock: ${fetchError?.message}`);
                        continue;
                    }

                    const updatedStock = Math.max(0, currentVariant.stock_quantity - (item.quantity || 1));

                    const { error: updateError } = await supabase
                        .from('product_variants')
                        .update({ stock_quantity: updatedStock })
                        .eq('id', item.variant_id);

                    if (updateError) {
                        console.error(`Error updating variant inventory: ${updateError.message}`);
                    } else {
                        console.log(`Inventory successfully decremented for Variant #${item.variant_id}. New stock: ${updatedStock}`);
                    }
                }
            }
        }
        
        const newOrder = (data && data.length > 0) 
            ? data[0] 
            : { customer_email: orderData.customer_email, customer_name: orderData.customer_name, id: 'Pending', items: orderData.items, total_amount: orderData.total_amount, shipping_address: orderData.shipping_address };
            
        await sendEmailNotification(newOrder.customer_email, newOrder.customer_name, newOrder.id, newOrder);
        
        return new Response(JSON.stringify({ success: true }), { status: 200 });
        
    } catch (e) {
        console.error("Checkout Server Error:", e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}