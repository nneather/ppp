export type LoanReminderModel = {
	id: string;
	subject: string;
	htmlBody: string;
	scheduledFor: string;
	status: string;
	error: string | null;
};

export type LoanCardModel = {
	id: string;
	bookId: string;
	bookTitle: string | null;
	bookAuthors: string | null;
	contactId: string;
	recipientName: string;
	recipientEmail: string;
	checkedOutOn: string;
	intervalDays: number;
	checkoutMessageId: string | null;
	checkoutStatus: string | null;
	checkoutError: string | null;
	reminder: LoanReminderModel | null;
};

export type LoanContactHit = {
	id: string;
	name: string;
	email: string | null;
};
