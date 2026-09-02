using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GradPlatformApi.Migrations
{
    /// <inheritdoc />
    public partial class AddSubmissionStudentAndStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "OriginalFileName",
                table: "submissions",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "submissions",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "StudentId",
                table: "submissions",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_submissions_StudentId",
                table: "submissions",
                column: "StudentId");

            migrationBuilder.AddForeignKey(
                name: "FK_submissions_Students_StudentId",
                table: "submissions",
                column: "StudentId",
                principalTable: "Students",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_submissions_Students_StudentId",
                table: "submissions");

            migrationBuilder.DropIndex(
                name: "IX_submissions_StudentId",
                table: "submissions");

            migrationBuilder.DropColumn(
                name: "OriginalFileName",
                table: "submissions");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "submissions");

            migrationBuilder.DropColumn(
                name: "StudentId",
                table: "submissions");
        }
    }
}
