# Privacy note

This sentence is shown to the owner beside Add photo. It is not shown to customers. There is no customer page.

Device photos are stored privately for the repair and deleted 12 months after the job is closed.

The phone prepares each photo before upload: it is redrawn and saved as a new JPEG, so location and other camera metadata are not stored. The file goes to the private `job-photos` bucket. The phone shows it with a signed link that lasts five minutes. The Action API still returns only a count and captions.
