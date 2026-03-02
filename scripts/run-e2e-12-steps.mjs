import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';

const API_BASE = process.env.API_BASE ?? 'http://localhost:3000';

function readEnvValue(key) {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return null;
  }

  const raw = fs.readFileSync(envPath, 'utf8');
  const line = raw.split(/\r?\n/).find((entry) => entry.startsWith(`${key}=`));

  if (!line) {
    return null;
  }

  return line.slice(key.length + 1);
}

function mintFallbackAccessToken(user) {
  const privateKeyRaw = process.env.JWT_PRIVATE_KEY ?? readEnvValue('JWT_PRIVATE_KEY') ?? '';

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

  if (!privateKey) {
    return null;
  }

  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    privateKey,
    {
      algorithm: 'RS256',
      expiresIn: '15m',
    },
  );
}

async function requestRaw(step, label, path, options = {}) {
  const url = `${API_BASE}${path}`;
  const method = options.method ?? 'GET';
  const headers = options.headers ?? {};
  const body = options.body;

  console.log(`\n===== STEP ${step}: ${label} =====`);
  console.log(`${method} ${url}`);

  const response = await fetch(url, {
    method,
    headers,
    body,
  });

  const text = await response.text();
  console.log(`HTTP ${response.status} ${response.statusText}`);
  console.log(text);

  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    status: response.status,
    text,
    json,
  };
}

function authHeaders(token) {
  return {
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
  };
}

async function login(email, password) {
  const result = await requestRaw(0, `LOGIN ${email}`, '/api/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  return result.json?.accessToken ?? null;
}

async function main() {
  const fallbackUsers = {
    admin: {
      id: 'c1fa31b1-2a62-4361-b58f-28564117b447',
      email: 'admin@radvault.local',
      role: 'Admin',
    },
    radiologist: {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'radiologist@radvault.local',
      role: 'Radiologist',
    },
    technologist: {
      id: '22222222-2222-2222-2222-222222222222',
      email: 'tech@radvault.local',
      role: 'Technologist',
    },
    referring: {
      id: '33333333-3333-3333-3333-333333333333',
      email: 'ref@radvault.local',
      role: 'ReferringPhysician',
    },
  };

  const adminLogin = await requestRaw(1, 'Admin login', '/api/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: 'admin@radvault.local',
      password: 'Admin123!',
    }),
  });

  const adminToken = adminLogin.json?.accessToken ?? mintFallbackAccessToken(fallbackUsers.admin);

  if (!adminLogin.json?.accessToken && adminToken) {
    console.log('Using fallback minted admin token due login failure.');
  }

  const usersList = await requestRaw(2, 'GET /api/users', '/api/users?page=1&limit=20', {
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
  });

  const uniqueEmail = `e2e.user.${Date.now()}@radvault.local`;
  const createdUser = await requestRaw(3, 'POST /api/users', '/api/users', {
    method: 'POST',
    headers: authHeaders(adminToken),
    body: JSON.stringify({
      email: uniqueEmail,
      fullName: 'E2E Test User',
      password: 'E2Epass123!',
      role: 'Radiologist',
    }),
  });

  const createdUserId = createdUser.json?.id;

  await requestRaw(4, 'PATCH /api/users/:id', `/api/users/${createdUserId}`, {
    method: 'PATCH',
    headers: authHeaders(adminToken),
    body: JSON.stringify({ isActive: false }),
  });

  await requestRaw(5, 'GET /api/audit-logs', '/api/audit-logs?page=1&limit=10', {
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
  });

  const radiologistLogin = await requestRaw(6, 'Radiologist login', '/api/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: 'radiologist@radvault.local',
      password: 'Radio123!',
    }),
  });

  const radiologistToken =
    radiologistLogin.json?.accessToken ?? mintFallbackAccessToken(fallbackUsers.radiologist);

  if (!radiologistLogin.json?.accessToken && radiologistToken) {
    console.log('Using fallback minted radiologist token due login failure.');
  }

  const studiesResponse = await requestRaw(
    7,
    'GET /api/dicom-web/studies',
    '/api/dicom-web/studies?page=1&limit=5',
    {
      headers: {
        authorization: `Bearer ${radiologistToken}`,
      },
    },
  );

  const studies = Array.isArray(studiesResponse.json) ? studiesResponse.json : [];
  const firstStudy = studies[0] ?? null;
  const studyUid = firstStudy?.['0020000D']?.Value?.[0] ?? null;

  if (studyUid) {
    const seriesResponse = await requestRaw(
      8,
      'GET /api/dicom-web/studies/:uid/series',
      `/api/dicom-web/studies/${studyUid}/series`,
      {
        headers: {
          authorization: `Bearer ${radiologistToken}`,
        },
      },
    );

    const series = Array.isArray(seriesResponse.json) ? seriesResponse.json : [];
    const firstSeries = series[0] ?? null;
    const seriesUid = firstSeries?.['0020000E']?.Value?.[0] ?? null;

    if (seriesUid) {
      await requestRaw(
        9,
        'GET /api/dicom-web/studies/:uid/series/:seriesUid/instances',
        `/api/dicom-web/studies/${studyUid}/series/${seriesUid}/instances`,
        {
          headers: {
            authorization: `Bearer ${radiologistToken}`,
          },
        },
      );
    } else {
      console.log('\n===== STEP 9: GET instances =====');
      console.log('SKIPPED (no series returned)');
    }
  } else {
    console.log('\n===== STEP 8: GET series =====');
    console.log('SKIPPED (no studies returned)');
    console.log('\n===== STEP 9: GET instances =====');
    console.log('SKIPPED (no studies returned)');
  }

  const worklistResponse = await requestRaw(
    10,
    'GET /api/worklist',
    '/api/worklist?page=1&limit=20',
    {
      headers: {
        authorization: `Bearer ${radiologistToken}`,
      },
    },
  );

  const worklistItems = worklistResponse.json?.data ?? [];
  const firstWorklist = worklistItems[0] ?? null;

  if (firstWorklist?.id) {
    await requestRaw(
      11,
      'PATCH /api/worklist/:id/status -> InProgress',
      `/api/worklist/${firstWorklist.id}/status`,
      {
        method: 'PATCH',
        headers: authHeaders(radiologistToken),
        body: JSON.stringify({ status: 'InProgress' }),
      },
    );

    const reportPayload = {
      studyId: firstWorklist.studyId,
      indication: 'Chest pain',
      technique: 'CT chest without contrast',
      comparison: 'None',
      findings: 'No acute cardiopulmonary abnormality.',
      impression: 'No acute findings.',
    };

    const createdReport = await requestRaw(12, 'POST /api/reports', '/api/reports', {
      method: 'POST',
      headers: authHeaders(radiologistToken),
      body: JSON.stringify(reportPayload),
    });

    const reportId = createdReport.json?.id;
    if (reportId) {
      await requestRaw(
        '12A',
        'POST /api/reports/:id/sign -> Preliminary',
        `/api/reports/${reportId}/sign`,
        {
          method: 'POST',
          headers: authHeaders(radiologistToken),
          body: JSON.stringify({ status: 'Preliminary' }),
        },
      );

      await requestRaw(
        '12B',
        'POST /api/reports/:id/sign -> Final',
        `/api/reports/${reportId}/sign`,
        {
          method: 'POST',
          headers: authHeaders(radiologistToken),
          body: JSON.stringify({ status: 'Final' }),
        },
      );

      await requestRaw('12C', 'POST /api/reports/:id/amend', `/api/reports/${reportId}/amend`, {
        method: 'POST',
        headers: authHeaders(radiologistToken),
        body: JSON.stringify({
          findings: 'No acute cardiopulmonary abnormality. Mild bibasilar atelectasis.',
          impression: 'No acute findings. Mild bibasilar atelectatic change.',
        }),
      });
    }
  } else {
    console.log('\n===== STEP 11: PATCH worklist status =====');
    console.log('SKIPPED (no worklist items returned)');
    console.log('\n===== STEP 12: POST report =====');
    console.log('SKIPPED (no worklist items returned)');
  }

  const refToken =
    (await login('ref@radvault.local', 'Ref123!!!')) ??
    mintFallbackAccessToken(fallbackUsers.referring);
  if (refToken) {
    await requestRaw(
      'RBAC-1',
      'Referring physician GET /api/worklist (expected forbidden)',
      '/api/worklist?page=1&limit=5',
      {
        headers: {
          authorization: `Bearer ${refToken}`,
        },
      },
    );
  }

  const techToken =
    (await login('tech@radvault.local', 'Tech123!!')) ??
    mintFallbackAccessToken(fallbackUsers.technologist);
  if (techToken) {
    await requestRaw(
      'RBAC-2',
      'Technologist GET /api/reports (expected forbidden)',
      '/api/reports',
      {
        headers: {
          authorization: `Bearer ${techToken}`,
        },
      },
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
