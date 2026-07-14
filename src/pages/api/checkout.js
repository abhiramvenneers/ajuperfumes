---
import Layout from '../layouts/Layout.astro';

// Pull the public Razorpay Key ID safely during rendering to feed securely to the client script
const publicRazorpayKeyId = import.meta.env.PUBLIC_RAZORPAY_KEY_ID || '';
---

<Layout title="Secure Checkout | Aju Perfumes">
    <!-- Inject Razorpay's Secure Web Checkout library dynamically -->
    <script is:inline src="https://checkout.razorpay.com/v1/checkout.js"></script>

    <!-- Securely pass the Astro server-side key to the client-side global window context -->
    <script is:inline define:vars={{ publicRazorpayKeyId }}>
        window.razorpayKeyId = publicRazorpayKeyId;
    </script>

    <div 
        class="max-w-[1400px] mx-auto px-6 lg:px-12 pb-32 pt-12 md:pt-20" 
        x-data="{ 
            isProcessing: false, 
            isSuccess: false,
            errorMessage: '',
            
            profile: {
                firstName: '',
                lastName: '',
                email: '',
                address: '',
                city: '',
                pincode: ''
            },
            
            async init() {
                // Fetch current session immediately to pre-fill address and secure user_id
                const checkSession = setInterval(async () => {
                    if (window.supabase) {
                        clearInterval(checkSession);
                        const { data: { session } } = await window.supabase.auth.getSession();
                        if (session && session.user) {
                            const meta = session.user.user_metadata || {};
                            this.profile.firstName = meta.firstName || '';
                            this.profile.lastName = meta.lastName || '';
                            this.profile.email = session.user.email || '';
                            this.profile.address = meta.address || '';
                            this.profile.city = meta.city || '';
                            this.profile.pincode = meta.pincode || '';
                        }
                    }
                }, 50);
                
                setTimeout(() => clearInterval(checkSession), 4000);
            },
            
            // Step 1: Initiate Razorpay Gateway overlay
            async initiateCheckout() {
                const form = document.getElementById('checkoutForm');
                this.errorMessage = '';
                
                if (!form.checkValidity()) {
                    form.reportValidity();
                    return;
                }
                
                if (this.$store.cart.items.length === 0) {
                    this.errorMessage = 'Your shopping bag is empty.';
                    return;
                }

                this.isProcessing = true;

                try {
                    // Create secure Razorpay Order on our server side first
                    const orderResponse = await fetch('/api/create-razorpay-order', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ amount: this.$store.cart.total })
                    });

                    const orderData = await orderResponse.json();

                    if (!orderResponse.ok) {
                        throw new Error(orderData.error || 'Failed to instantiate merchant gateway order.');
                    }

                    // Retrieve public key from global window scope
                    const activeKey = window.razorpayKeyId;
                    if (!activeKey) {
                        throw new Error('Razorpay Public Key ID is missing in environment variables.');
                    }

                    // Configure official Razorpay Checkout overlays
                    const options = {
                        key: activeKey,
                        amount: orderData.amount,
                        currency: orderData.currency,
                        name: "Aju House",
                        description: "Premium Curations Checkout",
                        order_id: orderData.id,
                        image: "https://ajuperfumes.com/apple-touch-icon.png", // Fallback placeholder
                        handler: async (response) => {
                            // Payment verification has completed successfully!
                            await this.finalizeOrder(response.razorpay_payment_id);
                        },
                        prefill: {
                            name: `${this.profile.firstName} ${this.profile.lastName}`,
                            email: this.profile.email
                        },
                        theme: {
                            color: "#000000" // Premium, luxury styling matching the Aju aesthetic
                        },
                        modal: {
                            ondismiss: () => {
                                this.isProcessing = false;
                            }
                        }
                    };

                    const rzp = new window.Razorpay(options);
                    rzp.on('payment.failed', (response) => {
                        this.errorMessage = `Payment declined: ${response.error.description}`;
                        this.isProcessing = false;
                    });

                    rzp.open();

                } catch (err) {
                    this.errorMessage = err.message;
                    this.isProcessing = false;
                }
            },

            // Step 2: Push the finalized order to Supabase and send the Resend branded receipt
            async finalizeOrder(paymentId) {
                this.errorMessage = '';

                const form = document.getElementById('checkoutForm');
                const formData = new FormData(form);
                
                const { data: { session } } = await window.supabase.auth.getSession();
                const activeUser = session?.user || null;

                const firstName = (formData.get('firstName') || formData.get('first_name') || '').trim();
                const lastName = (formData.get('lastName') || formData.get('last_name') || '').trim();
                
                // Attach verified Razorpay payment receipt ID as trace log
                const paymentTracker = ` [PAID VIA RAZORPAY | Payment ID: ${paymentId}]`;

                const orderData = {
                    customer_name: `${firstName} ${lastName}`,
                    customer_email: (formData.get('email') || '').trim(),
                    shipping_address: `${formData.get('address')}, ${formData.get('city')} - ${formData.get('pincode')}${paymentTracker}`,
                    total_amount: this.$store.cart.total,
                    items: this.$store.cart.items,
                    user_id: activeUser ? activeUser.id : null
                };

                try {
                    // Update customer account metadata safely
                    if (activeUser && window.supabase) {
                        await window.supabase.auth.updateUser({
                            data: {
                                firstName,
                                lastName,
                                address: formData.get('address'),
                                city: formData.get('city'),
                                pincode: formData.get('pincode')
                            }
                        });
                    }

                    const res = await fetch('/api/checkout', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(orderData)
                    });

                    const result = await res.json();

                    if (!res.ok) {
                        throw new Error(result.error || 'Failed to register completed order.');
                    }
                    
                    // Success transitions
                    this.isProcessing = false;
                    this.isSuccess = true;
                    
                    localStorage.removeItem('cartItems');
                    this.$store.cart.items = [];
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    
                } catch (err) {
                    this.errorMessage = `System Error during final processing: ${err.message}. Please contact client care with payment ID: ${paymentId}`;
                    this.isProcessing = false;
                }
            }
        }"
        x-init="init()"
    >
        <!-- Page Header -->
        <div class="text-center mb-16 md:mb-24">
            <h1 class="text-4xl md:text-5xl font-serif font-medium tracking-tight text-gray-900 mb-4">Secure Checkout</h1>
            <p class="text-sm text-gray-500 font-light tracking-wide uppercase font-sans">Payment Integration Active</p>
        </div>

        <!-- Success Message -->
        <div x-show="isSuccess" class="max-w-2xl mx-auto text-center py-20" style="display: none;" x-transition:enter="transition ease-out duration-700 transform" x-transition:enter-start="opacity-0 translate-y-8" x-transition:enter-end="opacity-100 translate-y-0">
            <div class="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8">
                <svg class="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h2 class="text-3xl font-serif font-medium mb-4 text-gray-900">Order Confirmed</h2>
            <p class="text-gray-500 mb-12 font-light text-lg">Thank you for your appreciation of Aju. Your signature items are being packaged.</p>
            <div class="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="/account" class="inline-block bg-black text-white px-10 py-4 uppercase text-[11px] font-bold tracking-[0.2em] hover:bg-gray-800 transition-colors shadow-xl">Track Order</a>
                <a href="/" class="inline-block border border-gray-200 text-gray-900 px-10 py-4 uppercase text-[11px] font-bold tracking-[0.2em] hover:bg-gray-50 transition-colors">Continue Shopping</a>
            </div>
        </div>

        <!-- Checkout Form Layout -->
        <div x-show="!isSuccess" class="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24 items-start">
            
            <!-- Form Side (Left) -->
            <div class="lg:col-span-7">
                <!-- Dynamic Error Notification Box -->
                <div x-show="errorMessage" 
                     x-transition
                     class="mb-8 p-4 bg-red-50 border border-red-100 text-red-700 text-xs font-semibold rounded-sm flex items-start gap-3"
                     style="display: none;"
                >
                    <svg class="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    <div>
                        <p class="font-bold uppercase tracking-wider mb-1">Transaction Blocked</p>
                        <p class="font-normal" x-text="errorMessage"></p>
                    </div>
                </div>

                <form id="checkoutForm" @submit.prevent="initiateCheckout" class="space-y-12">
                    
                    <!-- Contact Section -->
                    <section>
                        <h2 class="text-sm font-bold text-gray-900 uppercase tracking-[0.2em] mb-6 pb-4 border-b border-gray-200">Contact Information</h2>
                        <div class="space-y-6">
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Email Address *</label>
                                <input 
                                    type="email" 
                                    name="email" 
                                    x-model="profile.email"
                                    required 
                                    class="w-full p-4 text-sm bg-gray-50/50 border border-gray-200 rounded-sm focus:outline-none transition-colors"
                                >
                            </div>
                        </div>
                    </section>

                    <!-- Shipping Section -->
                    <section>
                        <h2 class="text-sm font-bold text-gray-900 uppercase tracking-[0.2em] mb-6 pb-4 border-b border-gray-200 flex justify-between items-end">
                            Shipping Details
                            <span x-show="$store.auth.user && profile.address" class="text-[9px] text-gray-400 normal-case tracking-normal font-medium italic" style="display: none;">Details loaded from profile</span>
                        </h2>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">First Name *</label>
                                <input type="text" name="firstName" x-model="profile.firstName" required class="w-full p-4 text-sm bg-gray-50/50 border border-gray-200 rounded-sm focus:border-black focus:outline-none transition-colors">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Last Name *</label>
                                <input type="text" name="lastName" x-model="profile.lastName" required class="w-full p-4 text-sm bg-gray-50/50 border border-gray-200 rounded-sm focus:border-black focus:outline-none transition-colors">
                            </div>
                            <div class="sm:col-span-2">
                                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Street Address *</label>
                                <input type="text" name="address" x-model="profile.address" required class="w-full p-4 text-sm bg-gray-50/50 border border-gray-200 rounded-sm focus:border-black focus:outline-none transition-colors">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">City *</label>
                                <input type="text" name="city" x-model="profile.city" required class="w-full p-4 text-sm bg-gray-50/50 border border-gray-200 rounded-sm focus:border-black focus:outline-none transition-colors">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Pincode / Postal Code *</label>
                                <input type="text" name="pincode" x-model="profile.pincode" required class="w-full p-4 text-sm bg-gray-50/50 border border-gray-200 rounded-sm focus:border-black focus:outline-none transition-colors">
                            </div>
                        </div>
                    </section>

                    <button 
                        type="submit" 
                        :disabled="isProcessing"
                        class="w-full bg-black text-white py-5 uppercase text-[11px] font-bold tracking-[0.2em] hover:bg-gray-800 transition-colors shadow-xl flex items-center justify-center gap-3"
                    >
                        <span x-show="!isProcessing">Proceed to Payment Gateway</span>
                        <span x-show="isProcessing" style="display: none;" class="flex items-center gap-2">
                            <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Connecting Secure Gateway...
                        </span>
                    </button>
                </form>
            </div>

            <!-- Order Summary Side (Right) -->
            <div class="lg:col-span-5 relative">
                <div class="bg-[#fcfcfc] p-8 lg:p-10 border border-gray-100 rounded-sm sticky top-28">
                    <h2 class="text-sm font-bold text-gray-900 uppercase tracking-[0.2em] mb-8 pb-4 border-b border-gray-200 font-sans">Order Summary</h2>
                    
                    <!-- Cart Items List -->
                    <div class="space-y-6 mb-8 max-h-[40vh] overflow-y-auto no-scrollbar pr-2">
                        <template x-for="item in $store.cart.items" :key="item.id">
                            <div class="flex gap-4 group">
                                <div class="w-16 h-20 bg-gray-100 flex items-center justify-center relative overflow-hidden flex-shrink-0">
                                    <span class="z-10 text-gray-400 font-serif italic text-[10px] text-center px-1" x-text="item.name.split(' ')[0]"></span>
                                </div>
                                <div class="flex-1 flex flex-col justify-center font-sans">
                                    <div class="flex justify-between items-start">
                                        <p class="font-serif font-medium text-gray-900" x-text="item.name"></p>
                                        <span class="font-sans font-medium text-sm text-gray-900" x-text="'₹' + (item.price * item.quantity).toLocaleString()"></span>
                                    </div>
                                    <p class="text-gray-500 text-[10px] uppercase tracking-widest mt-1 font-bold" x-text="item.volume + ' • Qty: ' + item.quantity"></p>
                                </div>
                            </div>
                        </template>
                        
                        <div x-show="$store.cart.items.length === 0" style="display: none;" class="text-center py-6">
                            <p class="text-gray-500 font-light text-sm">Your bag is empty.</p>
                        </div>
                    </div>

                    <!-- Totals -->
                    <div class="border-t border-gray-200 pt-6 space-y-4 font-sans">
                        <div class="flex justify-between text-sm font-light text-gray-600">
                            <span>Subtotal</span>
                            <span x-text="'₹' + $store.cart.total.toLocaleString()">₹0.00</span>
                        </div>
                        <div class="flex justify-between text-sm font-light text-gray-600">
                            <span>Shipping</span>
                            <span class="uppercase text-[10px] tracking-widest font-bold">Complimentary</span>
                        </div>
                        <div class="flex justify-between font-serif font-medium text-2xl pt-6 border-t border-gray-200 text-gray-900 mt-2">
                            <span>Total</span>
                            <span x-text="'₹' + $store.cart.total.toLocaleString()">₹0.00</span>
                        </div>
                    </div>
                </div>
            </div>

        </div>

    </div>
</Layout>