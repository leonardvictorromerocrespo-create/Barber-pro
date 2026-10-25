// Provider-neutral server boundary. A provider adapter must verify the actual
// signature and query its authoritative API. No fallback/mock implementation.
export async function handlePaymentNotification({rawBody,headers,adapter,db}){
  if(!adapter || typeof adapter.verifyNotification!=='function' || typeof adapter.retrievePayment!=='function') throw Error('Payment provider is not configured');
  const event=await adapter.verifyNotification({rawBody,headers});
  if(!event || typeof event.paymentId!=='string' || !event.paymentId) throw Error('Invalid payment notification');
  const payment=await adapter.retrievePayment(event.paymentId);
  if(!payment || payment.id!==event.paymentId) throw Error('Payment identity mismatch');
  if(payment.status!=='approved') return {status:'not_confirmed'};
  if(!Number.isSafeInteger(payment.amountCents) || payment.amountCents<=0 || payment.currency!=='PEN'
     || typeof payment.live!=='boolean' || !payment.provider || !payment.reference || !payment.merchantId) throw Error('Invalid verified payment');
  const {rows}=await db.query(`select id from meryo_private.payment_intents where proveedor=$1 and referencia=$2`,[payment.provider,payment.reference]);
  if(rows.length!==1) throw Error('Unknown payment intent; reconciliation required');
  const result=await db.query(`select public.confirmar_pago_verificado($1,$2,$3,$4,$5,$6,$7) as status`,
    [rows[0].id,payment.provider,payment.reference,payment.merchantId,payment.amountCents,payment.currency,payment.live]);
  return {status:result.rows[0].status};
}
