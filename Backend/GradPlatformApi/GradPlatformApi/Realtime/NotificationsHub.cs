using Microsoft.AspNetCore.SignalR;

namespace GradPlatformApi.Realtime
{
    public class NotificationsHub : Hub
    {
        public Task JoinUserRoom(string userId) =>
            Groups.AddToGroupAsync(Context.ConnectionId, $"user:{userId}");
    }
}
