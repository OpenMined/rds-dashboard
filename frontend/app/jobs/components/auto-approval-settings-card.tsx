import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { trustedDatasitesApi } from "@/lib/api/trusted-datasites"
import { cn } from "@/lib/utils"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Plus, Settings, X } from "lucide-react"
import { useForm } from "react-hook-form"
import z from "zod"

export function AutoApprovalSettingsCard() {
  const queryClient = useQueryClient()

  const loadDataQuery = useQuery({
    queryKey: ["autoApproved"],
    queryFn: async () => trustedDatasitesApi.getTrustedDatasites(),
  })
  const { isPending, data } = loadDataQuery

  const form = useForm<z.infer<typeof EmailFormSchema>>({
    resolver: zodResolver(EmailFormSchema),
    defaultValues: {
      email: "",
    },
  })

  const addEmailMutation = useMutation({
    mutationFn: async ({
      autoApprovedEmails,
      email,
    }: {
      autoApprovedEmails: string[]
      email: string
    }) => {
      if (!email) return
      if (autoApprovedEmails.includes(email)) return
      const updatedList = [...autoApprovedEmails, email]
      return trustedDatasitesApi.setTrustedDatasites(updatedList)
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["autoApproved"] })
      form.reset()
    },
  })

  const removeEmailMutation = useMutation({
    mutationFn: async ({
      autoApprovedEmails,
      email,
    }: {
      autoApprovedEmails: string[]
      email: string
    }) => {
      if (!email) return

      const updatedList = autoApprovedEmails.filter((e) => e !== email)
      return trustedDatasitesApi.setTrustedDatasites(updatedList)
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["autoApproved"] }),
  })

  function onSubmit(values: z.infer<typeof EmailFormSchema>) {
    addEmailMutation.mutate({
      autoApprovedEmails: data?.datasites ?? [],
      email: values.email,
    })
  }

  const isMutationPending =
    addEmailMutation.isPending || removeEmailMutation.isPending

  return (
    <Card className="relative">
      {isPending ? (
        <Loader2
          size={64}
          className="absolute inset-0 z-10 m-auto animate-spin"
        />
      ) : null}

      <CardHeader
        className={cn(
          isMutationPending || isPending
            ? "pointer-events-none opacity-50"
            : "opacity-100",
          "relative transition-opacity duration-100",
        )}
      >
        <CardTitle className="flex items-center">
          <Settings className="mr-2 h-5 w-5" />
          Auto-approval Settings
        </CardTitle>
        <CardDescription>
          Automatically approve requests from trusted datasites
        </CardDescription>
      </CardHeader>
      <CardContent
        className={cn(
          isMutationPending || isPending
            ? "pointer-events-none opacity-50"
            : "opacity-100",
          "relative transition-opacity duration-100",
        )}
      >
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex items-end gap-2"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>Add a trusted datasite email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="trusted@email.com"
                      type="email"
                      autoComplete="off"
                      disabled={isPending}
                      className="w-full"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Button disabled={isPending} className="size-10 shrink-0">
              {addEmailMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="size-5" />
              )}
            </Button>
          </form>
        </Form>
        <div className="mt-4 flex flex-wrap gap-2">
          {data?.datasites.map((datasiteEmail) => (
            <Badge
              key={datasiteEmail}
              variant="secondary"
              className="flex items-center gap-1"
            >
              {datasiteEmail}
              <button
                onClick={() =>
                  removeEmailMutation.mutate({
                    email: datasiteEmail,
                    autoApprovedEmails: data.datasites,
                  })
                }
                className="hover:text-destructive ml-1"
                disabled={isPending}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

const EmailFormSchema = z.object({
  email: z.email("Not a valid email address"),
})
