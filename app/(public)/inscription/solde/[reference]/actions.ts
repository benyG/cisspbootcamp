"use server";

import { balanceCardCheckout, balanceMobileCheckout } from "@/lib/balance-checkout";

export async function payBalanceByCard(formData: FormData): Promise<void> {
  await balanceCardCheckout(formData);
}

export async function payBalanceByMobileMoney(formData: FormData): Promise<void> {
  await balanceMobileCheckout(formData);
}
