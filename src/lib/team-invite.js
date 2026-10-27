const KEY='meryo-team-invite-v1',TTL=7*86400000;
export function readTeamInvite(storage,hash='',now=Date.now()){
 const token=hash.match(/^#team-invite\/([0-9a-f]{64})$/)?.[1];
 if(token){storage.setItem(KEY,JSON.stringify({token,at:now}));return token;}
 try{const saved=JSON.parse(storage.getItem(KEY));if(saved&&/^[0-9a-f]{64}$/.test(saved.token)&&Number.isFinite(saved.at)&&saved.at<=now&&now-saved.at<TTL)return saved.token;}catch{}
 storage.removeItem(KEY);return '';
}
export const clearTeamInvite=storage=>storage.removeItem(KEY);
