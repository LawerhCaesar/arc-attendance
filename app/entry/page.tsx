'use client';

import { useState, useRef, useEffect } from 'react';
import Navbar from '@/components/Navbar';

interface AttendanceEntry {
  id: string;
  name: string;
  phone: string;
  location: string;
  birthday: string;
  fellowship: string;
  firstTimer: boolean;
}

export default function EntryPage() {
  const [entries, setEntries] = useState<AttendanceEntry[]>([
    {
      id: Date.now().toString(),
    name: '',
    phone: '',
    location: '',
    birthday: '',
      fellowship: '',
      firstTimer: false,
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submittedEntries, setSubmittedEntries] = useState<AttendanceEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [markedPresent, setMarkedPresent] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedSearchQuery, setSubmittedSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const entriesRef = useRef<AttendanceEntry[]>([]);
  const markedPresentRef = useRef<Set<string>>(new Set());
  const fetchSubmittedEntriesRef = useRef<(() => Promise<void>) | null>(null);
  
  // Keep refs in sync with state
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);
  
  useEffect(() => {
    markedPresentRef.current = markedPresent;
  }, [markedPresent]);

  // Get today's date key for localStorage
  const getTodayKey = () => {
    return `attendance-${new Date().toISOString().split('T')[0]}`;
  };

  // Load persisted data from localStorage
  const loadPersistedData = () => {
    try {
      const todayKey = getTodayKey();
      const stored = localStorage.getItem(todayKey);
      if (stored) {
        const data = JSON.parse(stored);
        // Only load if the stored date matches today
        if (data.date === new Date().toISOString().split('T')[0]) {
          if (data.entries && Array.isArray(data.entries) && data.entries.length > 0) {
            setEntries(data.entries);
          }
          if (data.markedPresent && Array.isArray(data.markedPresent)) {
            setMarkedPresent(new Set(data.markedPresent));
          }
        } else {
          // New day - reset to default
          setEntries([{
            id: Date.now().toString(),
            name: '',
            phone: '',
            location: '',
            birthday: '',
            fellowship: '',
            firstTimer: false,
          }]);
          setMarkedPresent(new Set());
        }
      }
    } catch (error) {
      console.error('Error loading persisted data:', error);
    }
  };

  // Save data to localStorage
  const savePersistedData = (currentEntries: AttendanceEntry[], currentMarkedPresent: Set<string>) => {
    try {
      const todayKey = getTodayKey();
      const data = {
        entries: currentEntries,
        markedPresent: Array.from(currentMarkedPresent),
        date: new Date().toISOString().split('T')[0],
      };
      localStorage.setItem(todayKey, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving persisted data:', error);
    }
  };

  // Clear old localStorage entries (keep only today and maybe yesterday for safety)
  const clearOldData = () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('attendance-')) {
          const keyDate = key.replace('attendance-', '');
          if (keyDate !== today) {
            localStorage.removeItem(key);
          }
        }
      });
    } catch (error) {
      console.error('Error clearing old data:', error);
    }
  };

  // Fetch submitted entries from Google Sheets on component mount and after submission
  const fetchSubmittedEntries = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/attendance');
      if (response.ok) {
        const data = await response.json();
        setSubmittedEntries(data);
      }
    } catch (error) {
      console.error('Error fetching attendance data:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Store function reference for auto-submit
  useEffect(() => {
    fetchSubmittedEntriesRef.current = fetchSubmittedEntries;
  }, []);

  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Auto-submit absent entries at 23:59 each day
  useEffect(() => {
    const scheduleAutoSubmit = () => {
      const now = new Date();
      const targetTime = new Date();
      targetTime.setHours(23, 59, 0, 0);
      
      // If it's already past 23:59 today, schedule for tomorrow
      if (now >= targetTime) {
        targetTime.setDate(targetTime.getDate() + 1);
      }
      
      const msUntilTarget = targetTime.getTime() - now.getTime();
      
      const timeoutId = setTimeout(async () => {
        // Get current entries at the time of execution using refs
        const currentEntries = entriesRef.current.filter(entry => 
          entry.name.trim() && 
          entry.phone.trim() && 
          entry.location.trim() && 
          entry.birthday.trim() && 
          entry.fellowship.trim() &&
          !markedPresentRef.current.has(entry.id)
        );

        if (currentEntries.length > 0) {
          const todayDate = new Date().toISOString().split('T')[0];
          
          try {
            const submitPromises = currentEntries.map(entry =>
              fetch('/api/attendance', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  name: entry.name,
                  phone: entry.phone,
                  location: entry.location,
                  birthday: entry.birthday,
                  fellowship: entry.fellowship,
                  firstTimer: entry.firstTimer,
                  attendanceDate: todayDate,
                  attendanceStatus: 'absent',
                }),
              })
            );

            await Promise.all(submitPromises);
            
            // Refresh submitted entries
            if (fetchSubmittedEntriesRef.current) {
              await fetchSubmittedEntriesRef.current();
            }
          } catch (error) {
            console.error('Error auto-submitting absent entries:', error);
          }
        }
        
        // Schedule next day's auto-submit
        scheduleAutoSubmit();
      }, msUntilTarget);

      return () => clearTimeout(timeoutId);
    };

    const cleanup = scheduleAutoSubmit();
    return cleanup;
  }, []); // Only run once on mount

  useEffect(() => {
    clearOldData();
    loadPersistedData();
    fetchSubmittedEntries();
    setIsInitialLoad(false);
  }, []);

  // Save to localStorage whenever entries or markedPresent changes (but not on initial load)
  useEffect(() => {
    if (!isInitialLoad) {
      savePersistedData(entries, markedPresent);
    }
  }, [entries, markedPresent, isInitialLoad]);

  const handleCellChange = (id: string, field: keyof AttendanceEntry, value: string | boolean) => {
    setEntries(entries.map(entry => 
      entry.id === id ? { ...entry, [field]: value } : entry
    ));
    setMessage(null);
  };

  const addRow = () => {
    setEntries([
      {
        id: Date.now().toString(),
        name: '',
        phone: '',
        location: '',
        birthday: '',
        fellowship: '',
        firstTimer: false,
      },
      ...entries,
    ]);
  };

  const removeRow = (id: string) => {
    if (entries.length > 1) {
      setEntries(entries.filter(entry => entry.id !== id));
      setEditingId(null);
    }
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
  };

  const handleSaveEdit = (id: string) => {
    setEditingId(null);
  };

  const handleCancelEdit = (id: string) => {
    setEditingId(null);
    // Optionally reload the row data if needed
  };

  const handleMarkPresent = (id: string) => {
    setMarkedPresent(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const formatDate = (date: Date = new Date()): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    // Get ordinal suffix
    const getOrdinalSuffix = (n: number): string => {
      const j = n % 10;
      const k = n % 100;
      if (j === 1 && k !== 11) return 'st';
      if (j === 2 && k !== 12) return 'nd';
      if (j === 3 && k !== 13) return 'rd';
      return 'th';
    };
    
    return `${dayName}, ${day}${getOrdinalSuffix(day)} ${month}, ${year}`;
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Dynamically import xlsx to avoid SSR issues
    const XLSX = await import('xlsx');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (jsonData.length < 2) {
          setMessage({ type: 'error', text: 'Excel file must have at least a header row and one data row' });
          return;
        }

        // Get header row (first row)
        const headers = jsonData[0].map((h: any) => String(h).toLowerCase().trim());
        
        // Map column names (flexible matching)
        const nameIndex = headers.findIndex(h => h.includes('name'));
        const contactIndex = headers.findIndex(h => h.includes('contact'));
        const phoneIndex = headers.findIndex(h => h.includes('phone'));
        const locationIndex = headers.findIndex(h => h.includes('location'));
        const birthdayIndex = headers.findIndex(h => h.includes('birthday') || h.includes('birth') || h.includes('dob') || h.includes('date of birth'));
        const fellowshipIndex = headers.findIndex(h => h.includes('fellowship'));
        const firstTimerIndex = headers.findIndex(h => h.includes('first') || h.includes('timer') || h.includes('new') || h.includes('first time'));

        if (nameIndex === -1 || locationIndex === -1 || birthdayIndex === -1 || fellowshipIndex === -1) {
          setMessage({ type: 'error', text: 'Excel file must contain columns: NAME, DATE OF BIRTH, LOCATION, FELLOWSHIP' });
          return;
        }

        // Parse data rows (skip header)
        const importedEntries: AttendanceEntry[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;

          const name = String(row[nameIndex] || '').trim();
          
          // Handle contact - get phone from contact or phone column
          let phone = '';
          if (contactIndex !== -1) {
            phone = String(row[contactIndex] || '').trim();
          }
          if (phoneIndex !== -1) phone = String(row[phoneIndex] || '').trim() || phone;
          
          const location = String(row[locationIndex] || '').trim();
          
          // Handle birthday - accept date and month only (DD-MM format)
          let birthday = '';
          const birthdayValue = row[birthdayIndex];
          if (birthdayValue !== undefined && birthdayValue !== null && birthdayValue !== '') {
            const dateStr = String(birthdayValue).trim();
            if (dateStr) {
              // Check if it's an Excel serial date (number)
              if (typeof birthdayValue === 'number') {
                // Excel serial date: 1 = January 1, 1900
                const excelEpoch = new Date(1899, 11, 30);
                const jsDate = new Date(excelEpoch.getTime() + birthdayValue * 24 * 60 * 60 * 1000);
                // Extract just day and month (DD-MM)
                const month = String(jsDate.getMonth() + 1).padStart(2, '0');
                const day = String(jsDate.getDate()).padStart(2, '0');
                birthday = `${day}-${month}`;
              } else {
                // Try to parse various date formats and extract DD-MM
                // Try DD-MM-YYYY, DD/MM/YYYY, MM-DD-YYYY, MM/DD/YYYY, YYYY-MM-DD
                const formats = [
                  /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/, // DD-MM-YYYY or DD/MM/YYYY
                  /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/, // YYYY-MM-DD
                ];
                
                let parsed = false;
                for (const format of formats) {
                  const match = dateStr.match(format);
                  if (match) {
                    let day, month;
                    if (match[3]) {
                      // DD-MM-YYYY format
                      day = match[1].padStart(2, '0');
                      month = match[2].padStart(2, '0');
                    } else {
                      // YYYY-MM-DD format
                      day = match[3].padStart(2, '0');
                      month = match[2].padStart(2, '0');
                    }
                    birthday = `${day}-${month}`;
                    parsed = true;
                    break;
                  }
                }
                
                // Try DD-MM or MM-DD format (already in correct format)
                if (!parsed) {
                  const simpleMatch = dateStr.match(/(\d{1,2})[-\/](\d{1,2})/);
                  if (simpleMatch) {
                    const part1 = simpleMatch[1].padStart(2, '0');
                    const part2 = simpleMatch[2].padStart(2, '0');
                    // Assume DD-MM format
                    birthday = `${part1}-${part2}`;
                  } else {
                    // Try parsing as full date and extracting day/month
                    const parsedDate = new Date(dateStr);
                    if (!isNaN(parsedDate.getTime())) {
                      const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
                      const day = String(parsedDate.getDate()).padStart(2, '0');
                      birthday = `${day}-${month}`;
                    } else {
                      birthday = dateStr; // Keep original if can't parse
                    }
                  }
                }
              }
            }
          }
          
          const fellowship = String(row[fellowshipIndex] || '').trim();
          
          // Handle first timer (could be Yes/No, true/false, 1/0, checkbox)
          let firstTimer = false;
          if (firstTimerIndex !== -1) {
            const firstTimerValue = String(row[firstTimerIndex] || '').toLowerCase().trim();
            firstTimer = ['yes', 'true', '1', 'y', 'checked'].includes(firstTimerValue);
          }

          // Only add if at least name is present
          if (name) {
            importedEntries.push({
              id: `${Date.now()}-${i}`,
              name,
              phone,
              location,
              birthday: birthday || '',
              fellowship,
              firstTimer,
            });
          }
        }

        if (importedEntries.length === 0) {
          setMessage({ type: 'error', text: 'No valid entries found in Excel file' });
          return;
        }

        // Replace current entries with imported ones
        setEntries(importedEntries);
        setMessage({ type: 'success', text: `Successfully imported ${importedEntries.length} entries from Excel` });
      } catch (error) {
        console.error('Error parsing Excel file:', error);
        setMessage({ type: 'error', text: 'Error parsing Excel file. Please check the file format.' });
      }
    };

    reader.onerror = () => {
      setMessage({ type: 'error', text: 'Error reading Excel file' });
    };

    reader.readAsBinaryString(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setMessage(null);

    // Only submit entries that are marked present
    const markedEntries = entries.filter(entry => 
      markedPresent.has(entry.id) &&
      entry.name.trim() && 
      entry.phone.trim() && 
      entry.location.trim() && 
      entry.birthday.trim() && 
      entry.fellowship.trim()
    );

    if (markedEntries.length === 0) {
      setMessage({ type: 'error', text: 'Please mark at least one entry as present to submit' });
      setIsSubmitting(false);
      return;
    }

    try {
      // Get today's date in YYYY-MM-DD format for the attendance column
      const todayDate = new Date().toISOString().split('T')[0];
      
      // Submit only marked present entries
      const submitPromises = markedEntries.map(entry => {
        return fetch('/api/attendance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: entry.name,
            phone: entry.phone,
            location: entry.location,
            birthday: entry.birthday,
            fellowship: entry.fellowship,
            firstTimer: entry.firstTimer,
            attendanceDate: todayDate,
            attendanceStatus: 'present',
          }),
        });
      });

      const responses = await Promise.all(submitPromises);
      const results = await Promise.all(responses.map(res => res.json()));

      const hasError = responses.some(res => !res.ok);
      
      if (hasError) {
        setMessage({ type: 'error', text: 'Some entries failed to submit. Please try again.' });
      } else {
        setMessage({ type: 'success', text: `${markedEntries.length} attendance record(s) submitted successfully!` });
        // Remove submitted entries from the table
        const remainingEntries = entries.filter(entry => !markedPresent.has(entry.id));
        if (remainingEntries.length === 0) {
          setEntries([{
            id: Date.now().toString(),
            name: '',
            phone: '',
            location: '',
            birthday: '',
            fellowship: '',
            firstTimer: false,
          }]);
        } else {
          setEntries(remainingEntries);
        }
        // Clear marked present set for submitted entries
        const newMarked = new Set(markedPresent);
        markedEntries.forEach(entry => newMarked.delete(entry.id));
        setMarkedPresent(newMarked);
        // Refresh submitted entries from Google Sheets
        await fetchSubmittedEntries();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-no-repeat bg-fixed relative"
      style={{ 
        backgroundImage: 'url(/background.jpg)'
      }}
    >
      {/* 40% opaque black overlay */}
      <div className="absolute inset-0 bg-black/40"></div>
      
      <div className="relative z-10">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Mark Attendance</h1>
              <div className="mt-2 flex items-center gap-4">
                <div className="text-sm text-gray-600">
                  Total Entries: <span className="font-semibold text-gray-900">{entries.length}</span>
                </div>
                <div className="text-sm text-gray-600">
                  Marked Present: <span className="font-semibold text-green-600">{markedPresent.size}</span>
                </div>
              </div>
            </div>
            <div className="space-x-2 flex items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleExcelImport}
                className="hidden"
                id="excel-upload"
              />
              <label
                htmlFor="excel-upload"
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition cursor-pointer"
              >
                Import Excel
              </label>
              <button
                onClick={addRow}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
              >
                Add Row
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isSubmitting ? 'Submitting...' : `Submit Present (${markedPresent.size})`}
              </button>
            </div>
          </div>
          
          {message && (
            <div
              className={`mb-4 p-4 rounded ${
                message.type === 'success'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="mb-4 pb-3 border-b border-gray-300">
            <p className="text-lg font-semibold text-gray-700">
              {formatDate()}
            </p>
          </div>

          {/* Search/Filter Section */}
          <div className="mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone, location, or fellowship..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider border-r border-gray-300">
                    NAME
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider border-r border-gray-300">
                    CONTACT
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider border-r border-gray-300">
                    DATE OF BIRTH
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider border-r border-gray-300">
                    LOCATION
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider border-r border-gray-300">
                    FELLOWSHIP
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider border-r border-gray-300">
                    FIRST TIME?
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {entries.filter(entry => {
                  if (!searchQuery.trim()) return true;
                  const query = searchQuery.toLowerCase();
                  return (
                    entry.name.toLowerCase().includes(query) ||
                    entry.phone.toLowerCase().includes(query) ||
                    entry.location.toLowerCase().includes(query) ||
                    entry.fellowship.toLowerCase().includes(query)
                  );
                }).map((entry) => {
                  const isEditing = editingId === entry.id;
                  const isPresent = markedPresent.has(entry.id);
                  return (
                    <tr key={entry.id} className={`hover:bg-gray-50 ${isPresent ? 'bg-green-50' : ''}`}>
                      <td className="px-3 py-2 border-r border-gray-300">
              <input
                type="text"
                          value={entry.name}
                          onChange={(e) => handleCellChange(entry.id, 'name', e.target.value)}
                          disabled={!isEditing}
                          readOnly={!isEditing}
                          className={`w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            !isEditing ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                          }`}
                          placeholder="Full name"
                        />
                      </td>
                      <td className="px-3 py-2 border-r border-gray-300">
              <input
                type="tel"
                          value={entry.phone}
                          onChange={(e) => handleCellChange(entry.id, 'phone', e.target.value)}
                          disabled={!isEditing}
                          readOnly={!isEditing}
                          className={`w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            !isEditing ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                          }`}
                          placeholder="Phone number"
                        />
                      </td>
                      <td className="px-3 py-2 border-r border-gray-300">
                        <input
                          type="text"
                          value={entry.birthday}
                          onChange={(e) => handleCellChange(entry.id, 'birthday', e.target.value)}
                          disabled={!isEditing}
                          readOnly={!isEditing}
                          className={`w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            !isEditing ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                          }`}
                          placeholder="DD-MM (e.g., 15-04)"
                        />
                      </td>
                      <td className="px-3 py-2 border-r border-gray-300">
              <input
                          type="text"
                          value={entry.location}
                          onChange={(e) => handleCellChange(entry.id, 'location', e.target.value)}
                          disabled={!isEditing}
                          readOnly={!isEditing}
                          className={`w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            !isEditing ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                          }`}
                          placeholder="Location"
                        />
                      </td>
                      <td className="px-3 py-2 border-r border-gray-300">
              <input
                type="text"
                          value={entry.fellowship}
                          onChange={(e) => handleCellChange(entry.id, 'fellowship', e.target.value)}
                          disabled={!isEditing}
                          readOnly={!isEditing}
                          className={`w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            !isEditing ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                          }`}
                          placeholder="Fellowship"
                        />
                      </td>
                      <td className="px-3 py-2 border-r border-gray-300">
                        <div className="flex items-center justify-center">
              <input
                            type="checkbox"
                            checked={entry.firstTimer}
                            onChange={(e) => handleCellChange(entry.id, 'firstTimer', e.target.checked)}
                            disabled={!isEditing}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleSaveEdit(entry.id)}
                                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition"
                                title="Save"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => handleCancelEdit(entry.id)}
                                className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition"
                                title="Cancel"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEdit(entry.id)}
                                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition whitespace-nowrap min-w-[70px]"
                                title="Edit row"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleMarkPresent(entry.id)}
                                className={`px-3 py-1 text-xs rounded transition whitespace-nowrap min-w-[70px] ${
                                  isPresent
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                                title="Mark present"
                              >
                                {isPresent ? 'Present' : 'Mark Present'}
                              </button>
                            </>
                          )}
                          {entries.length > 1 && !isEditing && (
            <button
                              onClick={() => removeRow(entry.id)}
                              className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition"
                              title="Remove row"
                            >
                              ✕
            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Submitted Entries Table */}
        {submittedEntries.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Submitted Entries</h2>
            
            {/* Search/Filter for Submitted Entries */}
            <div className="mb-4">
              <input
                type="text"
                value={submittedSearchQuery}
                onChange={(e) => setSubmittedSearchQuery(e.target.value)}
                placeholder="Search submitted entries..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                      NAME
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                      CONTACT
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                      DATE OF BIRTH
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                      LOCATION
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                      FELLOWSHIP
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                      FIRST TIME?
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {submittedEntries.filter(entry => {
                    if (!submittedSearchQuery.trim()) return true;
                    const query = submittedSearchQuery.toLowerCase();
                    return (
                      entry.name.toLowerCase().includes(query) ||
                      entry.phone.toLowerCase().includes(query) ||
                      entry.location.toLowerCase().includes(query) ||
                      entry.fellowship.toLowerCase().includes(query)
                    );
                  }).map((entry, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {entry.name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {entry.phone}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {entry.birthday || ''}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {entry.location}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {entry.fellowship}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          entry.firstTimer 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {entry.firstTimer ? 'Yes' : 'No'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
