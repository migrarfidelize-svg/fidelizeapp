import { evolutionOtp } from "./evolution";
import { uazapiOtp } from "./uazapi";
import { zapiOtp } from "./zapi";
import { customOtp } from "./custom";

export const otpProviders = [
  evolutionOtp,
  uazapiOtp,
  zapiOtp,
  customOtp,
];
