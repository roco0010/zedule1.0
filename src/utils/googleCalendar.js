/**
 * Utility to sync appointments with Google Calendar
 */

export const createGoogleCalendarEvent = async (appointment, ownerToken, ownerTimezone = null) => {
    if (!ownerToken) return null;

    const { clientName, clientEmail, service, startTime, duration, clientAddress, clientPhone } = appointment;

    // Calculate end time
    const start = startTime?.seconds
        ? new Date(startTime.seconds * 1000)
        : (startTime instanceof Date ? startTime : new Date(startTime));

    const end = new Date(start.getTime() + (duration || 30) * 60000);

    const event = {
        summary: `${service}: ${clientName}`,
        location: clientAddress || 'Online Session',
        description: `Appointment booked via Zedule.\nCustomer: ${clientName} (${clientEmail})\nPhone: ${clientPhone || 'N/A'}\nAddress: ${clientAddress || 'N/A'}`,
        start: {
            dateTime: start.toISOString(),
            timeZone: ownerTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
            dateTime: end.toISOString(),
            timeZone: ownerTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        attendees: [],
        reminders: {
            useDefault: true
        }
    };









    // Only add attendee if the email is valid to avoid Google API errors
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (clientEmail && emailRegex.test(clientEmail)) {
        event.attendees.push({ email: clientEmail });
    }

    try {
        console.log('Attempting to create Google Calendar event with token:', ownerToken.substring(0, 5) + '...');
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
            console.error('Google Calendar API Error Details:', error);
            if (error.error?.status === 'PERMISSION_DENIED') {
                alert("Google Calendar: Permission Denied. Check if the 'Google Calendar API' is enabled in your Google Cloud Console.");
            } else if (error.error?.code === 401) {
                alert("Google Calendar: Session expired. Please reconnect Google Calendar in your settings.");
            } else {
                alert(`Google Calendar Error: ${error.error?.message || 'Unknown error'}`);
            }
            return null;
        }

        const data = await response.json();
        console.log('Google Calendar event created successfully:', data.htmlLink);
        return data;
    } catch (err) {
        console.error('Failed to create Google Calendar event (Network Error):', err);
        alert("Network error connecting to Google Calendar API.");
        return null;
    }
};

/**
 * Fetch busy slots from Google Calendar to prevent overlaps
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
                timeMin: timeMin.toISOString(),
                timeMax: timeMax.toISOString(),
                items: [{ id: 'primary' }]
            })
        });

        if (!response.ok) {
            console.error('Failed to fetch Google FreeBusy data');
            return [];
        }

        const data = await response.json();
        const busy = data.calendars.primary.busy.map(slot => ({
            start: new Date(slot.start),
            end: new Date(slot.end)
        }));

        return busy;
    } catch (err) {
        console.error('Error fetching Google FreeBusy:', err);
        return [];
    }
};
