using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GradPlatformApi.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectSubmissionTexts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProjectSubmissionTexts_Projects_ProjectId",
                table: "ProjectSubmissionTexts");

            migrationBuilder.DropIndex(
                name: "IX_ProjectSubmissionTexts_ProjectId",
                table: "ProjectSubmissionTexts");

            migrationBuilder.RenameColumn(
                name: "UpdatedAt",
                table: "ProjectSubmissionTexts",
                newName: "UpdatedAtUtc");

            migrationBuilder.AddColumn<int>(
                name: "StudentId",
                table: "ProjectSubmissionTexts",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StudentId",
                table: "ProjectSubmissionTexts");

            migrationBuilder.RenameColumn(
                name: "UpdatedAtUtc",
                table: "ProjectSubmissionTexts",
                newName: "UpdatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectSubmissionTexts_ProjectId",
                table: "ProjectSubmissionTexts",
                column: "ProjectId");

            migrationBuilder.AddForeignKey(
                name: "FK_ProjectSubmissionTexts_Projects_ProjectId",
                table: "ProjectSubmissionTexts",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
