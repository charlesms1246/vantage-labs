import { pixelify_sans } from '@/app/fonts';
import Notification from './Notification';

interface NotificationBoardProps {
    notifications: any[];
}

const NotificationBoard = ({ notifications }: NotificationBoardProps) => {
    return (
        <div className="w-full h-full max-h-screen flex flex-col bg-card p-4 overflow-hidden border-l rounded-lg">
            <h2 className={`font-semibold tracking-tight text-2xl text-blue-900 mb-4 ${pixelify_sans.className}`}>
                System Events
            </h2>
            <div className="flex-1 overflow-y-auto">
                <div className="space-y-2">
                    {notifications?.map((notification) => {
                        const agent: string = notification.metadata?.agent || 'System';
                        const status: string | undefined = notification.metadata?.status;
                        const eventName = status === 'executing' || status === 'complete' ? 'system' : undefined;
                        const safeMetadata: Record<string, string> | undefined =
                            notification.metadata && typeof notification.metadata === 'object'
                                ? Object.fromEntries(
                                    Object.entries(notification.metadata).filter(([, v]) => typeof v === 'string')
                                  ) as Record<string, string>
                                : undefined;
                        return (
                            <Notification
                                key={notification.id}
                                characterName={agent}
                                timestamp={new Date(notification.timestamp)}
                                message={notification.message}
                                eventName={eventName}
                                metadata={safeMetadata}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default NotificationBoard;
