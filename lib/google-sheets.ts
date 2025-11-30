import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

export interface AttendanceRecord {
  date: string;
  name: string;
  phone: string;
  location: string;
  birthday: string;
  fellowship: string;
  firstTimer: string;
  attendanceDate?: string;
  attendanceStatus?: string;
}

let authClient: any = null;

function getAuthClient() {
  if (authClient) {
    return authClient;
  }

  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!serviceAccountEmail || !privateKey) {
    throw new Error('Google Sheets credentials not configured');
  }

  authClient = new google.auth.JWT(
    serviceAccountEmail,
    undefined,
    privateKey,
    SCOPES
  );

  return authClient;
}

export async function appendAttendance(record: AttendanceRecord): Promise<void> {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error('Google Sheets spreadsheet ID not configured');
  }

  // Ensure headers exist, including attendance date column if provided
  if (record.attendanceDate) {
    await ensureHeaders(sheets, spreadsheetId, record.attendanceDate);
  }

  // Build the row with base columns
  const baseRow = [
    record.date,
    record.name,
    record.phone,
    record.location,
    record.birthday,
    record.fellowship,
    record.firstTimer,
  ];
  
  // Add attendance status if date is provided
  const row = record.attendanceDate 
    ? baseRow.concat([record.attendanceStatus || ''])
    : baseRow;
  
  const values = [row];
  
  // Determine the range based on number of columns
  const numCols = row.length;
  const lastCol = getColumnLetter(numCols);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `Sheet1!A:${lastCol}`,
    valueInputOption: 'RAW',
    requestBody: {
      values,
    },
  });
}

export async function getAttendanceData(): Promise<AttendanceRecord[]> {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error('Google Sheets spreadsheet ID not configured');
  }

  // First, ensure headers exist
  await ensureHeaders(sheets, spreadsheetId, undefined);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Sheet1!A2:I', // Skip header row
  });

  const rows = response.data.values || [];
  
  return rows
    .filter(row => row.length >= 5) // Ensure row has minimum required fields
    .map(row => ({
      date: row[0] || '',
      name: row[1] || '',
      phone: row[2] || '',
      location: row[3] || '',
      birthday: row[4] || '',
      fellowship: row[5] || '',
      firstTimer: row[6] || '',
      attendanceDate: row[7] || '',
      attendanceStatus: row[8] || '',
    }));
}

function getColumnLetter(colNum: number): string {
  let result = '';
  while (colNum > 0) {
    colNum--;
    result = String.fromCharCode(65 + (colNum % 26)) + result;
    colNum = Math.floor(colNum / 26);
  }
  return result;
}

async function ensureHeaders(sheets: any, spreadsheetId: string, attendanceDate?: string): Promise<void> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A1:I1',
    });

    const headers = response.data.values?.[0] || [];
    
    if (headers.length === 0 || headers[0] !== 'Date') {
      const baseHeaders = ['Date', 'Name', 'Phone', 'Location', 'Birthday', 'Fellowship', 'First Timer'];
      const headersToSet = attendanceDate 
        ? [...baseHeaders, attendanceDate]
        : baseHeaders;
      
      const lastCol = getColumnLetter(headersToSet.length);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Sheet1!A1:${lastCol}1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headersToSet],
        },
      });
    } else if (attendanceDate && !headers.includes(attendanceDate)) {
      // Add attendance date column if it doesn't exist
      const newHeaders = [...headers, attendanceDate];
      const lastCol = getColumnLetter(newHeaders.length);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Sheet1!A1:${lastCol}1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [newHeaders],
        },
      });
    }
  } catch (error: any) {
    // If sheet doesn't exist or is empty, create headers
    if (error.code === 400 || error.code === 404) {
      const baseHeaders = ['Date', 'Name', 'Phone', 'Location', 'Birthday', 'Fellowship', 'First Timer'];
      const headersToSet = attendanceDate 
        ? [...baseHeaders, attendanceDate]
        : baseHeaders;
      
      const lastCol = getColumnLetter(headersToSet.length);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Sheet1!A1:${lastCol}1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headersToSet],
        },
      });
    }
  }
}

