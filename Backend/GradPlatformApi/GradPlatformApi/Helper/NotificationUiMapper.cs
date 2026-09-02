using GradPlatformApi.Model.Communication;

namespace GradPlatformApi.Helpers
{
    public static class NotificationUiMapper
    {
        public static string ToUiType(NotificationType type)
        {
            return type switch
            {
                NotificationType.TeamJoinRequestReceived or NotificationType.TeamInviteReceived => "type-join",
                NotificationType.MilestoneCommentAdded => "type-comment",
                NotificationType.SupervisionRequestDecision or NotificationType.ProjectApprovalDecision => "type-approval",
                NotificationType.MilestoneDueTomorrow or NotificationType.MilestoneScheduled or NotificationType.SubmissionAdded => "type-deadline",
                _ => "type-deadline"
            };
        }
    }
}
