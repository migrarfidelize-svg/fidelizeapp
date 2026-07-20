import type { PaymentProvider } from "./base";
import { mercadopagoProvider } from "./mercadopago";
import { asaasProvider } from "./asaas";
import { stripeProvider } from "./stripe";
import { pagseguroProvider } from "./pagseguro";
import { pagarmeProvider } from "./pagarme";

export const paymentProviders: PaymentProvider[] = [
  mercadopagoProvider,
  asaasProvider,
  stripeProvider,
  pagseguroProvider,
  pagarmeProvider,
];
