import { supabase } from '../../lib/supabase.js';

export const prerender = false;

// Helper function to send emails via Resend API
async function sendEmailNotification(toEmail, customerName, orderId) {
    const RESEND_API_KEY = import.meta.env.RESEND_API_KEY; 
    
    if (!RESEND_API_KEY) {
        console.log("\n❌ EMAIL ABORTED: RESEND_API_KEY is missing in your .env file!");
        console.log("Make sure you added it and restarted your dev server.\n");
        return;
    }

    console.log(`\n✉️ Attempting to send order confirmation email to: ${toEmail}...`);

    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Aju Perfumes <orders@ajuperfumes.com>', // Verified Branded Email Address
                to: [toEmail],
                subject: 'Order Confirmed - Aju Perfumes',
                html: `
                    <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0f0f0;">
                        <h2 style="color: #111; font-family: Georgia, serif; font-weight: normal; margin-bottom: 24px;">Thank you for your order, ${customerName}!</h2>
                        <p style="color: #333; font-size: 14px; line-height: 1.6;">We have received your order <strong>#${orderId || 'New'}</strong> and are currently preparing it for dispatch.</p>
                        <p style="color: #333; font-size: 14px; line-height: 1.6;">Your status is currently set to: <strong style="text-transform: uppercase; font-size: 12px; background-color: #f5f5f5; padding: 4px 8px;">placed</strong>.</p>
                        <p style="color: #333; font-size: 14px; line-height: 1.6;">You can track your order status in real-time by visiting your <a href="https://ajuperfumes.com/account" style="color: #000; font-weight: bold; text-decoration: underline;">Aju Perfumes Account Portal</a>.</p>
                        <br/>
                        <p style="color: #888; font-size: 11px; border-t: 1px solid #eee; padding-top: 15px; margin-top: 30px;">&copy; Aju Perfumes. All Rights Reserved.</p>
                    </div>
                `
            })
        });

        const resData = await res.json();

        if (!res.ok) {
            console.log("❌ RESEND REJECTED THE EMAIL. Reason from Resend:");
            console.log(resData);
        } else {
            console.log("✅ EMAIL SENT SUCCESSFULLY! Resend ID:", resData.id);
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

        // 2. STAGE 4 AUTOMATED STOCK DECREMENT: Iterate over items and update current quantity levels safely
        if (orderData.items && Array.isArray(orderData.items)) {
            for (const item of orderData.items) {
                // Fetch the current product quantity count
                const { data: currentProduct, error: fetchError } = await supabase
                    .from('perfumes')
                    .select('stock_quantity')
                    .eq('id', item.id)
                    .single();

                if (fetchError || !currentProduct) {
                    console.error(`Error querying stock for perfume ID ${item.id}:`, fetchError?.message);
                    continue;
                }

                // Protect against negative stock amounts
                const decrementedStock = Math.max(0, currentProduct.stock_quantity - (item.quantity || 1));

                // Update database
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
            : { customer_email: orderData.customer_email, customer_name: orderData.customer_name, id: 'Pending' };
            
        // 4. Send the email and wait for it
        await sendEmailNotification(newOrder.customer_email, newOrder.customer_name, newOrder.id);
        
        return new Response(JSON.stringify({ success: true }), { status: 200 });
        
    } catch (e) {
        console.error("Checkout Server Error:", e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}