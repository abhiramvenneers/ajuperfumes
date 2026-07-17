import { createClient } from '@supabase/supabase-js';

export const prerender = false;

/**
 * Astro POST API Route to securely manage products and their dynamic variations.
 * Now fully authenticated - uses the admin user's JWT token to satisfy Supabase RLS.
 */
export async function POST({ request }) {
    try {
        const body = await request.json();
        const { action, id, name, category, image_url, notes, variants } = body;

        // 1. Extract the Authorization bearer token sent by the Admin Panel (Case-insensitive check)
        const authHeader = request.headers.get('Authorization') || '';
        const token = authHeader.replace(/^[Bb]earer\s+/, '').trim();

        if (!token) {
            return new Response(JSON.stringify({ 
                error: "Unauthorized: Missing administrative security token. Please sign out and sign back in on perfumesaju@gmail.com." 
            }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }

        const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

        // 2. Instantiate an authenticated Supabase client using the admin user's JWT
        const authClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        });

        // 3. Double-check token ownership directly with Supabase auth server for security
        const { data: { user }, error: authError } = await authClient.auth.getUser(token);
        if (authError || !user || user.email !== 'perfumesaju@gmail.com') {
            return new Response(JSON.stringify({ error: "Access Denied: Unauthorized admin session" }), { status: 401 });
        }

        // =====================================================================
        // ACTIONS (Now executed with verified admin write permissions)
        // =====================================================================

        // 1. DELETE ACTION
        if (action === 'delete') {
            const { error } = await authClient.from('products').delete().eq('id', id);
            if (error) throw error;
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        // 2. ADD ACTION
        if (action === 'add') {
            // Insert Base Product
            const { data: newProd, error: prodErr } = await authClient
                .from('products')
                .insert([{ name, category, image_url, notes }])
                .select()
                .single();

            if (prodErr) throw prodErr;

            // Insert nested Variants
            if (variants && Array.isArray(variants) && variants.length > 0) {
                const variantsToInsert = variants.map(v => ({
                    product_id: newProd.id,
                    variant_label: v.variant_label,
                    price_override: v.price_override ? parseFloat(v.price_override) : null,
                    stock_quantity: parseInt(v.stock_quantity) || 0
                }));

                const { error: varErr } = await authClient
                    .from('product_variants')
                    .insert(variantsToInsert);

                if (varErr) throw varErr;
            }

            return new Response(JSON.stringify({ success: true, product: newProd }), { status: 200 });
        }

        // 3. EDIT ACTION
        if (action === 'edit') {
            // Update Base Product Metadata
            const { error: updateErr } = await authClient
                .from('products')
                .update({ name, category, image_url, notes })
                .eq('id', id);

            if (updateErr) throw updateErr;

            // Delete and re-insert variants to preserve sequence cleanly
            const { error: delVarErr } = await authClient
                .from('product_variants')
                .delete()
                .eq('product_id', id);

            if (delVarErr) throw delVarErr;

            if (variants && Array.isArray(variants) && variants.length > 0) {
                const variantsToInsert = variants.map(v => ({
                    product_id: id,
                    variant_label: v.variant_label,
                    price_override: v.price_override ? parseFloat(v.price_override) : null,
                    stock_quantity: parseInt(v.stock_quantity) || 0
                }));

                const { error: insVarErr } = await authClient
                    .from('product_variants')
                    .insert(variantsToInsert);

                if (insVarErr) throw insVarErr;
            }

            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        return new Response(JSON.stringify({ error: "Invalid Action" }), { status: 400 });

    } catch (e) {
        console.error("Products Server Error:", e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}