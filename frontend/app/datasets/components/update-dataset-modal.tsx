"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { datasetsApi, UpdateShopifyDatasetFormSchema } from "@/lib/api/datasets"
import { ApiError, FormFieldError } from "@/lib/api/errors"
import type { Dataset } from "@/lib/api/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Edit, Loader2, SaveIcon } from "lucide-react"
import { useForm } from "react-hook-form"
import type z from "zod"

export function UpdateDatasetModal({ dataset }: { dataset: Dataset }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const form = useForm<z.infer<typeof UpdateShopifyDatasetFormSchema>>({
    resolver: zodResolver(UpdateShopifyDatasetFormSchema),
    defaultValues: {
      name: dataset.name,
      description: dataset.description,
    },
  })

  const { setError } = form

  const updateShopifyDatasetMutation = useMutation({
    mutationFn: datasetsApi.updateShopifyDataset,
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Updated dataset",
      })
      return queryClient.invalidateQueries({ queryKey: ["datasets"] })
    },
    onError: (error) => {
      if (error instanceof FormFieldError) {
        //@ts-ignore
        setError(error.loc, { message: error.message })
      }
      if (error instanceof ApiError) {
        toast({ title: "Error", description: error.message })
      }
    },
  })

  function onSubmit(values: z.infer<typeof UpdateShopifyDatasetFormSchema>) {
    // strip the fields that didn't change
    const newValues = {
      ...values,
      name: values.name !== dataset.name ? values.name : undefined,
      description:
        values.description !== dataset.description
          ? values.description
          : undefined,
    }
    updateShopifyDatasetMutation.mutate({ uid: dataset.uid, data: newValues })
  }

  const { isPending } = updateShopifyDatasetMutation

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start">
          <Edit className="h-4 w-4" />
          Update Dataset
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Dataset</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
          >
            <FormField
              name="name"
              render={({ field }) => (
                <FormItem>
                  <div className="relative w-full">
                    <FormLabel>Dataset Name</FormLabel>
                    <FormMessage className="absolute top-1 right-0" />
                  </div>
                  <FormControl>
                    <Input placeholder={dataset.name} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              name="description"
              render={({ field }) => (
                <FormItem>
                  <div className="relative w-full">
                    <FormLabel>Description</FormLabel>
                    <FormMessage className="absolute top-1 right-0" />
                  </div>
                  <FormControl>
                    <Textarea placeholder={dataset.name} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    form.reset()
                  }}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <SaveIcon className="h-4 w-4" />
                    Save Change
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
