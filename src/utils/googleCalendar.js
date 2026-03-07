/**
 * Utility to sync appointments with Google Calendar
 *
 * KEY RULE (Google Calendar API):
 * When sending { dateTime, timeZone }, the dateTime MUST be a "wall clock"
 * local time string with NO 'Z' and NO offset suffix — e.g. "2024-03-07T09:00:00"
 *
 * If dateTime ends in 'Z' (from toISOString()), Google interprets it as UTC
 * and completely ignores the timeZone field, causing the hours shift bug.
 */

/**
 * Converts a JS Date (UTC internally) to a wall-clock datetime string
 * as it would appear on a clock in the given IANA timezone.
 * Output format: "YYYY-MM-DDTHH:mm:ss" — NO 'Z', NO offset
 */
const toWallClockString = (date, timeZone) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(date);

    const get = (type) => parts.find(p => p.type === type)?.value ?? '00';

    // en-CA locale can return '24' for midnight with hour12:false — normalize it
    const hour = get('hour') === '24' ? '00' : get('hour');

    return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}`;
};

/**
 * Creates a Google Calendar event for the given appointment.
 * @param {object} appointment - The appointment data from Firestore/Booking
 * @param {string} ownerToken  - The owner's Google OAuth access token
 * @param {string} ownerTimezone - IANA timezone string e.g. "America/New_York"
 */
export const createGoogleCalendarEvent = async (appointment, ownerToken, ownerTimezone = null) => {
    if (!ownerToken) return null;

    const { clientName, clientEmail, service, startTime, duration, clientAddress, clientPhone } = appointment;
    const tz = ownerTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Resolve startTime — handles Firestore Timestamps, JS Date objects, and ISO strings
    const startDate = startTime?.seconds
        ? new Date(startTime.seconds * 1000)
        : (startTime instanceof Date ? startTime : new Date(startTime));

    const endDate = new Date(startDate.getTime() + (duration || 30) * 60000);

    // Convert to wall-clock strings in the owner's timezone — NO 'Z', NO offset
    const startWall = toWallClockString(startDate, tz);
    const endWall = toWallClockString(endDate, tz);

    console.log(`[GCal] Event | tz="${tz}" | start="${startWall}" | end="${endWall}"`);

    const event = {
        summary: `${service}: ${clientName}`,
        location: clientAddress || 'Online Session',
        description: `Appointment booked via Zedule.\nCustomer: ${clientName} (${clientEmail})\nPhone: ${clientPhone || 'N/A'}\nAddress: ${clientAddress || 'N/A'}`,
        start: {
            dateTime: startWall,  // ✅ Wall-clock string, no Z
            timeZone: tz           // ✅ Google uses this to interpret the wall-clock string
        },
        end: {
            dateTime: endWall,    // ✅ Same format
            timeZone: tz
        },
        attendees: [],
        reminders: {
            useDefault: true
        }
    };

    // Only add attendee if email is valid — invalid emails cause Google API errors
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (clientEmail && emailRegex.test(clientEmail)) {
        event.attendees.push({ email: clientEmail });
    }

    try {
        console.log('[GCal] Sending event payload:', JSON.stringify(event.start));
        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ownerToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(event)
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('[GCal] API Error:', error);
            if (error.error?.status === 'PERMISSION_DENIED') {
                alert("Google Calendar: Permission Denied. Make sure the 'Google Calendar API' is enabled in Google Cloud Console.");
            } else if (error.error?.code === 401) {
                alert("Google Calendar: Session expired. Please reconnect Google Calendar in your settings.");
            } else {
                alert(`Google Calendar Error: ${error.error?.message || 'Unknown error'}`);
            }
            return null;
        }

        const data = await response.json();
        console.log('[GCal] Event created successfully:', data.htmlLink);
        return data;
    } catch (err) {
        console.error('[GCal] Network error:', err);
        alert("Network error connecting to Google Calendar API.");
        return null;
    }
};

/**
 * Fetch busy time slots from Google Calendar (FreeBusy API).
 * Returns UTC-based Date objects which are timezone-agnostic for overlap detection.
 */
export const getGoogleBusySlots = async (ownerToken, timeMin, timeMax) => {
    if (!ownerToken) return [];

    try {
        const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ownerToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                timeMin: timeMin.toISOString(),  // FreeBusy API correctly accepts ISO/UTC
                timeMax: timeMax.toISOString(),
                items: [{ id: 'primary' }]
            })
        });

        if (!response.ok) {
            console.error('[GCal] Failed to fetch FreeBusy data');
            return [];
        }

        const data = await response.json();
        return data.calendars.primary.busy.map(slot => ({
            start: new Date(slot.start),
            end: new Date(slot.end)
        }));
    } catch (err) {
        console.error('[GCal] Error fetching FreeBusy:', err);
        return [];
    }
};

/**
 * Deletes a Google Calendar event by its stored event ID.
 * Returns true on success or if already deleted (404). Non-blocking on failure.
 * @param {string} ownerToken    - The owner's Google OAuth access token
 * @param {string} googleEventId - The event ID saved in Firestore when created
 */
export const deleteGoogleCalendarEvent = async (ownerToken, googleEventId) => {
    if (!ownerToken || !googleEventId) return false;

    try {
        const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
            {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${ownerToken}` }
            }
        );

        // 204 No Content = deleted. 404 = already gone. Both are acceptable.
        if (response.status === 204 || response.status === 404) {
            console.log(`[GCal] Event "${googleEventId}" removed from Google Calendar.`);
            return true;
        }

        const error = await response.json().catch(() => ({}));
        console.error('[GCal] Failed to delete event:', error);
        return false;
    } catch (err) {
        console.error('[GCal] Network error deleting event:', err);
        return false;
    }
};
