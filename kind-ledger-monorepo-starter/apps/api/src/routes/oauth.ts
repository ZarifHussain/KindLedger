
import { Router } from 'express';
import axios from 'axios';
import { prisma } from '../lib/db.js';
import { encrypt } from '../lib/crypto.js';

export const router = Router();

router.get('/xero/start', (_req, res) => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.XERO_CLIENT_ID || '',
    redirect_uri: process.env.XERO_REDIRECT_URI || '',
    scope: (process.env.XERO_SCOPES || 'openid profile email accounting.transactions accounting.contacts offline_access'),
    state: 'xero-' + Math.random().toString(36).slice(2)
  });
  res.redirect(`https://login.xero.com/identity/connect/authorize?${params.toString()}`);
});

router.get('/xero/callback', async (req, res) => {
  const { code } = req.query as Record<string,string>;
  try {
    const tokenResp = await axios.post('https://identity.xero.com/connect/token',
      new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: process.env.XERO_REDIRECT_URI || '' }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': 'Basic ' + Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString('base64') } }
    );
    const connResp = await axios.get('https://api.xero.com/connections', { headers: { Authorization: `Bearer ${tokenResp.data.access_token}` } });
    const tenant = Array.isArray(connResp.data) && connResp.data.length ? connResp.data[0] : null;
    await prisma.ledger.upsert({
      where: { provider_external_tenant_id: `${tenant?.tenantId || 'xero-unknown'}` },
      update: {
        provider: 'xero', display_name: tenant?.tenantName || 'Xero Org',
        access_token_enc: encrypt(tokenResp.data.access_token),
        refresh_token_enc: encrypt(tokenResp.data.refresh_token),
        expires_at: new Date(Date.now() + tokenResp.data.expires_in * 1000),
      },
      create: {
        tenant_id: 'demo-tenant', provider: 'xero', display_name: tenant?.tenantName || 'Xero Org',
        provider_external_tenant_id: `${tenant?.tenantId || 'xero-unknown'}`,
        access_token_enc: encrypt(tokenResp.data.access_token),
        refresh_token_enc: encrypt(tokenResp.data.refresh_token),
        expires_at: new Date(Date.now() + tokenResp.data.expires_in * 1000),
      }
    });
    res.redirect('http://localhost:3000/connections?connected=xero');
  } catch (e: any) {
    console.error('Xero callback error', e?.response?.data || e.message);
    res.status(500).send('Xero auth failed');
  }
});

router.get('/qbo/start', (_req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.QBO_CLIENT_ID || '',
    response_type: 'code',
    scope: (process.env.QBO_SCOPES || 'com.intuit.quickbooks.accounting openid email profile'),
    redirect_uri: process.env.QBO_REDIRECT_URI || '',
    state: 'qbo-' + Math.random().toString(36).slice(2)
  });
  res.redirect(`https://appcenter.intuit.com/connect/oauth2?${params.toString()}`);
});

router.get('/qbo/callback', async (req, res) => {
  const { code, realmId } = req.query as Record<string,string>;
  try {
    const tokenResp = await axios.post('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: process.env.QBO_REDIRECT_URI || '' }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': 'Basic ' + Buffer.from(`${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`).toString('base64') } }
    );
    await prisma.ledger.upsert({
      where: { provider_external_tenant_id: `${realmId || 'qbo-unknown'}` },
      update: {
        provider: 'qbo', display_name: 'QuickBooks Company',
        access_token_enc: encrypt(tokenResp.data.access_token),
        refresh_token_enc: encrypt(tokenResp.data.refresh_token),
        expires_at: new Date(Date.now() + tokenResp.data.expires_in * 1000),
      },
      create: {
        tenant_id: 'demo-tenant', provider: 'qbo', display_name: 'QuickBooks Company',
        provider_external_tenant_id: `${realmId || 'qbo-unknown'}`,
        access_token_enc: encrypt(tokenResp.data.access_token),
        refresh_token_enc: encrypt(tokenResp.data.refresh_token),
        expires_at: new Date(Date.now() + tokenResp.data.expires_in * 1000),
      }
    });
    res.redirect('http://localhost:3000/connections?connected=qbo');
  } catch (e: any) {
    console.error('QBO callback error', e?.response?.data || e.message);
    res.status(500).send('QBO auth failed');
  }
});
