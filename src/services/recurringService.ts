import { db, type RecurringTransaction, type Transaction } from '../db';
import { format, addMonths, parseISO, endOfMonth, setDate, addDays } from 'date-fns';

let isProcessing = false;

export async function processRecurringTransactions(isInitial: boolean = false): Promise<number[]> {
  const newTransactionIds: number[] = [];
  if (isProcessing) {
    return newTransactionIds;
  }
  isProcessing = true;
  try {
    const allRecurring = await db.recurring_transactions.toArray();
    const activeRecurring = allRecurring.filter(r => r.is_active);
    const today = format(new Date(), 'yyyy-MM-dd');
    
    if (isInitial) {
      console.log(`Starting recurring transactions processing (${activeRecurring.length} active found)...`);
    }

    for (const template of activeRecurring) {
      try {
        await db.transaction('rw', [db.transactions, db.recurring_transactions], async () => {
          let nextDateStr = template.next_execution_date;
          let updated = false;

          // Safety counter to prevent infinite loops
          let iterations = 0;
          const MAX_ITERATIONS = 500; 

          while (nextDateStr <= today && iterations < MAX_ITERATIONS) {
            iterations++;
            const externalId = `recurring_${template.id}_${nextDateStr}`;
            
            // Check if already exists
            const existing = await db.transactions.where('external_id').equals(externalId).first();
            
            if (!existing) {
              console.log(`Booking transaction for ${nextDateStr}: ${template.description}`);
              const newTransaction: Transaction = {
                description: template.description,
                amount: template.amount,
                date: nextDateStr,
                account_id: template.account_id,
                category_id: template.category_id,
                external_id: externalId,
                updated_at: Date.now()
              };
              
              try {
                const id = await db.transactions.add(newTransaction);
                if (typeof id === 'number') {
                  newTransactionIds.push(id);
                }
              } catch (addError: any) {
                if (addError.name !== 'ConstraintError') {
                  throw addError;
                }
              }
            }

            // Advance schedule
            const prevDateStr = nextDateStr;
            const currentNextDate = parseISO(nextDateStr);
            const nextMonthFirst = addMonths(new Date(currentNextDate.getFullYear(), currentNextDate.getMonth(), 1), 1);
            const lastDayOfNextMonth = endOfMonth(nextMonthFirst);
            const targetDay = template.day_of_month;
            
            let finalNextDate: Date;
            if (targetDay > lastDayOfNextMonth.getDate()) {
              finalNextDate = lastDayOfNextMonth;
            } else {
              finalNextDate = setDate(nextMonthFirst, targetDay);
            }
            
            nextDateStr = format(finalNextDate, 'yyyy-MM-dd');

            // Ensure advancement to avoid infinite loops
            if (nextDateStr <= prevDateStr) {
              console.warn(`Advancement failed for ${template.description}. Forcing next day.`);
              const forcedNext = addDays(parseISO(prevDateStr), 1);
              nextDateStr = format(forcedNext, 'yyyy-MM-dd');
            }
            
            updated = true;
          }

          if (updated) {
            await db.recurring_transactions.update(template.id!, {
              next_execution_date: nextDateStr,
              updated_at: Date.now()
            });
          }
        });
      } catch (templateError) {
        console.error(`Error processing template ${template.id} (${template.description}):`, templateError);
      }
    }
  } catch (error) {
    console.error('Global error processing recurring transactions:', error);
  } finally {
    isProcessing = false;
  }
  return newTransactionIds;
}
